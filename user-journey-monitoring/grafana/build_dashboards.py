"""Generate the User Journey dashboards (Funnel + Session Drilldown) as Grafana JSON."""
import json
import re
import sys

LOKI = {"type": "loki", "uid": "loki"}
PROM = {"type": "prometheus", "uid": "metrics"}
JAEGER = {"type": "jaeger", "uid": "jaeger"}

APP = '{service_name="$app"}'
JS = f'{APP} | event_name="journey_step"'
SERVER = 'job="$ns/shop-server"'
WEB = 'job="$ns/$app"'
STEPS = ["browse", "view_product", "add_to_cart", "view_cart", "begin_checkout", "place_order", "order_confirmed"]
PAGE = ('| label_format page=`{{ regexReplaceAll "/products/[^/?#]+" (regexReplaceAll "/orders/[^/?#]+" '
        '(regexReplaceAll "[?#].*$" (regexReplaceAll "^https?://[^/]+" .page_url "") "") "/orders/:id") "/products/:id" }}`')
ORDERED = ' | journey_step="order_confirmed"'
VITALS = [("lcp", "LCP", "ms"), ("inp", "INP", "ms"), ("cls", "CLS", "none"), ("fcp", "FCP", "ms"), ("ttfb", "TTFB", "ms")]

_id = 0


def pid():
    global _id
    _id += 1
    return _id


def loki(expr, ref="A", instant=False, legend="", fmt=None):
    t = {"datasource": LOKI, "refId": ref, "expr": expr, "queryType": "instant" if instant else "range",
         "legendFormat": legend}
    if fmt:
        t["format"] = fmt
    return t


def prom(expr, ref="A", instant=False, legend="", fmt=None):
    t = {"datasource": PROM, "refId": ref, "expr": expr, "instant": instant, "range": not instant,
         "legendFormat": legend}
    if fmt:
        t["format"] = fmt
    return t


def sessions(filt="", rng="$__range"):
    return f'count(count by (session_id) (count_over_time({JS}{filt} [{rng}])))'


def panel(ptype, title, grid, targets, unit=None, opts=None, defaults=None, overrides=None, transformations=None,
          ds=None, desc=None):
    fd = {"unit": unit} if unit else {}
    fd.update(defaults or {})
    p = {"id": pid(), "type": ptype, "title": title, "gridPos": dict(zip("xywh", grid)), "targets": targets,
         "datasource": ds or targets[0]["datasource"], "options": opts or {},
         "fieldConfig": {"defaults": fd, "overrides": overrides or []}}
    if transformations:
        p["transformations"] = transformations
    if desc:
        p["description"] = desc
    return p


def row(title, y):
    return {"id": pid(), "type": "row", "title": title, "collapsed": False, "panels": [],
            "gridPos": {"x": 0, "y": y, "w": 24, "h": 1}}


def stat(title, grid, targets, unit=None, decimals=None, thresholds=None, color_mode="value", no_value="0"):
    d = {"noValue": no_value, "color": {"mode": "thresholds"},
         "thresholds": thresholds or {"mode": "absolute", "steps": [{"color": "text", "value": None}]}}
    if decimals is not None:
        d["decimals"] = decimals
    return panel("stat", title, grid, targets, unit, defaults=d,
                 opts={"reduceOptions": {"calcs": ["lastNotNull"], "fields": "", "values": False},
                       "colorMode": color_mode, "graphMode": "none", "textMode": "value", "justifyMode": "center"})


def ts(title, grid, targets, unit=None, stacked=False, bars=False):
    custom = {"drawStyle": "bars" if bars else "line", "fillOpacity": 70 if bars else 10, "lineWidth": 1,
              "stacking": {"mode": "normal" if stacked else "none", "group": "A"}, "showPoints": "never",
              "spanNulls": True}
    return panel("timeseries", title, grid, targets, unit, defaults={"custom": custom, "noValue": "0"},
                 opts={"legend": {"displayMode": "list", "placement": "bottom", "showLegend": True},
                       "tooltip": {"mode": "multi", "sort": "desc"}})


def bargauge(title, grid, targets, unit=None, max_=None, color="continuous-BlPu", sort=None):
    d = {"color": {"mode": color}, "min": 0, "noValue": "0", "decimals": 0}
    if max_ is not None:
        d["max"] = max_
    t = [{"id": "sortBy", "options": {"sort": [{"field": sort, "desc": True}]}}] if sort else None
    # Loki instant queries ignore legendFormat (bars show "Value #A"), so pin each
    # query's display name explicitly; {{label}} legends become field-label lookups.
    overrides = [{"matcher": {"id": "byFrameRefID", "options": q["refId"]},
                  "properties": [{"id": "displayName",
                                  "value": re.sub(r"\{\{\s*(\w+)\s*\}\}", r"${__field.labels.\1}", q["legendFormat"])}]}
                 for q in targets if q.get("legendFormat")]
    return panel("bargauge", title, grid, targets, unit, defaults=d, transformations=t, overrides=overrides,
                 opts={"orientation": "horizontal", "displayMode": "gradient", "showUnfilled": True,
                       "valueMode": "text", "namePlacement": "left", "sizing": "auto",
                       "reduceOptions": {"calcs": ["lastNotNull"], "fields": "", "values": False}})


def logs(title, grid, expr):
    return panel("logs", title, grid, [loki(expr)],
                 opts={"showTime": True, "wrapLogMessage": True, "sortOrder": "Ascending", "enableLogDetails": True,
                       "dedupStrategy": "none", "prettifyLogMessage": False, "showCommonLabels": False})


def vitals_table(title, grid, filt, agg):
    targets = [loki(f'{agg}{APP}{filt} | kind="measurement" | logfmt | {k}!="" {PAGE} | unwrap {k} [$__range]) by (page)',
                    ref=chr(65 + i), instant=True, fmt="table") for i, (k, _, _) in enumerate(VITALS)]
    rename = {f"Value #{chr(65 + i)}": name for i, (_, name, _) in enumerate(VITALS)}
    rename["page"] = "Page"
    overrides = [{"matcher": {"id": "byName", "options": name},
                  "properties": [{"id": "unit", "value": unit}, {"id": "decimals", "value": 3 if k == "cls" else 0},
                                 {"id": "custom.cellOptions", "value": {"type": "color-text"}},
                                 {"id": "thresholds", "value": {"mode": "absolute", "steps": thr}}]}
                 for k, name, unit in VITALS
                 for thr in [{"lcp": [{"color": "green", "value": None}, {"color": "orange", "value": 2500}, {"color": "red", "value": 4000}],
                              "inp": [{"color": "green", "value": None}, {"color": "orange", "value": 200}, {"color": "red", "value": 500}],
                              "cls": [{"color": "green", "value": None}, {"color": "orange", "value": 0.1}, {"color": "red", "value": 0.25}],
                              "fcp": [{"color": "green", "value": None}, {"color": "orange", "value": 1800}, {"color": "red", "value": 3000}],
                              "ttfb": [{"color": "green", "value": None}, {"color": "orange", "value": 800}, {"color": "red", "value": 1800}]}[k]]]
    return panel("table", title, grid, targets, defaults={"noValue": "–"}, overrides=overrides,
                 opts={"showHeader": True, "cellHeight": "sm"},
                 transformations=[{"id": "merge", "options": {}},
                                  {"id": "organize", "options": {"excludeByName": {"Time": True}, "renameByName": rename,
                                                                 "indexByName": {"page": 0}}}])


def variables(extra=()):
    return {"list": [
        {"name": "app", "label": "App", "type": "custom", "query": "shop-web",
         "current": {"text": "shop-web", "value": "shop-web"}, "options": [], "hide": 0},
        {"name": "ns", "label": "Namespace", "type": "custom", "query": "observable-outfitters",
         "current": {"text": "observable-outfitters", "value": "observable-outfitters"}, "options": [], "hide": 0},
        *extra]}


def dashboard(uid, title, panels, templating, links):
    return {"uid": uid, "title": title, "tags": ["user-journey", "faro", "otel"], "timezone": "browser",
            "editable": True, "graphTooltip": 1, "refresh": "30s", "schemaVersion": 39,
            "time": {"from": "now-6h", "to": "now"}, "panels": panels, "templating": templating,
            "links": links, "annotations": {"list": []}}


def funnel():
    p, y = [], 0
    p.append(row("Overview", y)); y += 1
    pct = {"mode": "absolute", "steps": [{"color": "red", "value": None}, {"color": "orange", "value": 50},
                                         {"color": "green", "value": 80}]}
    p += [
        stat("Sessions", (0, y, 4, 4), [loki(sessions(), instant=True)], decimals=0),
        stat("Orders", (4, y, 4, 4), [loki(sessions(' | journey_step="order_confirmed"'), instant=True)], decimals=0),
        stat("Conversion", (8, y, 4, 4), [loki(f'({sessions(ORDERED)}) / ({sessions()}) * 100', instant=True)],
             unit="percent", decimals=1),
        stat("Checkout success", (12, y, 4, 4), [prom(
            f'sum(increase(shop_checkout_attempts_total{{{SERVER},outcome="success"}}[$__range])) / sum(increase(shop_checkout_attempts_total{{{SERVER}}}[$__range])) * 100',
            instant=True)], unit="percent", decimals=1, thresholds=pct),
        stat("Revenue", (16, y, 3, 4), [prom(f'sum(increase(shop_order_value_USD_sum{{{SERVER}}}[$__range]))', instant=True)],
             unit="currencyUSD", decimals=2),
        stat("Avg order value", (19, y, 2, 4), [prom(
            f'sum(increase(shop_order_value_USD_sum{{{SERVER}}}[$__range])) / sum(increase(shop_order_value_USD_count{{{SERVER}}}[$__range]))',
            instant=True)], unit="currencyUSD", decimals=2),
        stat("p95 payment", (21, y, 3, 4), [prom(
            f'histogram_quantile(0.95, sum by (le) (increase(shop_payment_duration_seconds_bucket{{{SERVER}}}[$__range])))',
            instant=True)], unit="s", decimals=2,
             thresholds={"mode": "absolute", "steps": [{"color": "green", "value": None}, {"color": "orange", "value": 1},
                                                       {"color": "red", "value": 3}]}),
    ]
    y += 4
    p.append(row("Funnel", y)); y += 1
    p.append(bargauge("Sessions reaching each step", (0, y, 12, 9),
                      [loki(sessions(f' | journey_step="{s}" | journey_outcome="success"'), ref=chr(65 + i), instant=True, legend=s)
                       for i, s in enumerate(STEPS)]))
    p.append(bargauge("% of sessions reaching each step", (12, y, 12, 9),
                      [loki(f'({sessions(f" | journey_step=\"{s}\" | journey_outcome=\"success\"")}) / ({sessions()}) * 100',
                            ref=chr(65 + i), instant=True, legend=s) for i, s in enumerate(STEPS)],
                      unit="percent", max_=100, color="continuous-RdYlGr"))
    y += 9
    p.append(ts("Journey steps (5m)", (0, y, 12, 8), [prom(
        f'sum by (journey_step) (increase(shop_journey_steps_total{{{WEB},journey_outcome="success"}}[5m]))',
        legend="{{journey_step}}")], unit="short", bars=True, stacked=True))
    p.append(ts("place_order failures by reason (5m)", (12, y, 8, 8), [prom(
        f'sum by (journey_error_reason) (increase(shop_journey_steps_total{{{WEB},journey_step="place_order",journey_outcome="failure"}}[5m]))',
        legend="{{journey_error_reason}}")], unit="short", bars=True, stacked=True))
    p.append(bargauge("Failure reasons", (20, y, 4, 8), [prom(
        f'sum by (journey_error_reason) (increase(shop_journey_steps_total{{{WEB},journey_outcome="failure"}}[$__range]))',
        instant=True, legend="{{journey_error_reason}}")], color="continuous-reds"))
    y += 8
    p.append(row("Checkout & payments (server)", y)); y += 1
    p.append(ts("Checkout attempts by outcome (5m)", (0, y, 8, 8), [prom(
        f'sum by (outcome, error_reason) (increase(shop_checkout_attempts_total{{{SERVER}}}[5m]))',
        legend="{{outcome}} · {{error_reason}}")], unit="short", bars=True, stacked=True))
    p.append(ts("Payment latency", (8, y, 8, 8), [
        prom(f'histogram_quantile({q}, sum by (le) (rate(shop_payment_duration_seconds_bucket{{{SERVER}}}[5m])))',
             ref=chr(65 + i), legend=f"p{int(q * 100)}") for i, q in enumerate([0.5, 0.95, 0.99])], unit="s"))
    p.append(bargauge("Cart additions by product", (16, y, 8, 8), [prom(
        f'sum by (product_id) (increase(shop_cart_additions_total{{{SERVER}}}[$__range]))', instant=True,
        legend="{{product_id}}")]))
    y += 8
    p.append(row("Frontend experience", y)); y += 1
    p.append(vitals_table("Web Vitals p75 by page", (0, y, 12, 8), "", "quantile_over_time(0.75, "))
    p.append(bargauge("JS errors by page", (12, y, 6, 8), [loki(
        f'sum by (page) (count_over_time({APP} | kind="exception" {PAGE} [$__range]))', instant=True, legend="{{page}}")],
        color="continuous-reds"))
    p.append(bargauge("Frustration signals", (18, y, 6, 8), [loki(
        f'sum by (event_name) (count_over_time({APP} | event_name=~"faro.frustration.*" [$__range]))', instant=True,
        legend="{{event_name}}")], color="continuous-YlRd"))
    y += 8
    p.append(logs("Exceptions and console warnings/errors", (0, y, 24, 8),
                  f'{APP} | kind=~"exception|log" | logfmt | kind="exception" or level=~"warn|error" '
                  f'| line_format "[{{{{.kind}}}}] {{{{.level}}}} {{{{.type}}}}{{{{.message}}}}{{{{.value}}}}  ·  {{{{.page_url}}}}  ·  session={{{{.session_id}}}}"'))
    return p


def drilldown():
    p, y = [], 0
    p.append(row("Sessions", y)); y += 1
    q = lambda filt, ref: loki(f'count by (session_id) (count_over_time({JS}{filt} [$__range]))', ref=ref, instant=True, fmt="table")
    link = [{"title": "Open session", "url": "/d/uj-session/user-journey-session-drilldown?var-session=${__value.raw}&${__url_time_range}"}]
    p.append(panel("table", "Recent sessions", (0, y, 24, 7), [
        q("", "A"), q(' | journey_outcome="failure"', "B"), q(' | journey_step="order_confirmed"', "C"),
        loki(f'count by (session_id) (count_over_time({APP} | kind="exception" [$__range]))', ref="D", instant=True, fmt="table")],
        defaults={"noValue": "0"},
        overrides=[{"matcher": {"id": "byName", "options": "Session"}, "properties": [{"id": "links", "value": link}]},
                   {"matcher": {"id": "byName", "options": "Failed steps"}, "properties": [
                       {"id": "custom.cellOptions", "value": {"type": "color-text"}},
                       {"id": "thresholds", "value": {"mode": "absolute", "steps": [{"color": "text", "value": None}, {"color": "red", "value": 1}]}}]},
                   {"matcher": {"id": "byName", "options": "Orders"}, "properties": [
                       {"id": "custom.cellOptions", "value": {"type": "color-text"}},
                       {"id": "thresholds", "value": {"mode": "absolute", "steps": [{"color": "text", "value": None}, {"color": "green", "value": 1}]}}]}],
        opts={"showHeader": True, "cellHeight": "sm", "sortBy": [{"displayName": "Journey events", "desc": True}]},
        transformations=[{"id": "merge", "options": {}},
                         {"id": "organize", "options": {"excludeByName": {"Time": True},
                                                        "renameByName": {"session_id": "Session", "Value #A": "Journey events",
                                                                         "Value #B": "Failed steps", "Value #C": "Orders",
                                                                         "Value #D": "JS errors"}}}]))
    y += 7
    p.append(row("Session: $session", y)); y += 1
    S = ' | session_id="$session"'
    p += [
        stat("Journey events", (0, y, 4, 4), [loki(f'sum(count_over_time({JS}{S} [$__range]))', instant=True)], decimals=0),
        stat("Failed steps", (4, y, 4, 4), [loki(f'sum(count_over_time({JS}{S} | journey_outcome="failure" [$__range]))', instant=True)],
             decimals=0, thresholds={"mode": "absolute", "steps": [{"color": "green", "value": None}, {"color": "red", "value": 1}]},
             color_mode="background"),
        stat("Orders", (8, y, 4, 4), [loki(f'sum(count_over_time({JS}{S} | journey_step="order_confirmed" [$__range]))', instant=True)],
             decimals=0, thresholds={"mode": "absolute", "steps": [{"color": "text", "value": None}, {"color": "green", "value": 1}]},
             color_mode="background"),
        stat("JS errors", (12, y, 4, 4), [loki(f'sum(count_over_time({APP}{S} | kind="exception" [$__range]))', instant=True)],
             decimals=0, thresholds={"mode": "absolute", "steps": [{"color": "green", "value": None}, {"color": "red", "value": 1}]},
             color_mode="background"),
        stat("Dead/rage clicks", (16, y, 4, 4), [loki(f'sum(count_over_time({APP}{S} | event_name=~"faro.frustration.*" [$__range]))', instant=True)],
             decimals=0, thresholds={"mode": "absolute", "steps": [{"color": "green", "value": None}, {"color": "orange", "value": 1}]},
             color_mode="background"),
        stat("Page views", (20, y, 4, 4), [loki(f'sum(count_over_time({APP}{S} | event_name=~"faro.performance.navigation|view_changed" [$__range]))', instant=True)],
             decimals=0),
    ]
    y += 4
    p.append(logs("Journey timeline", (0, y, 10, 11),
                  f'{JS}{S} | line_format "{{{{.journey_step}}}}  {{{{ if eq .journey_outcome \\"failure\\" }}}}✗ FAILED ({{{{.journey_error_reason}}}}){{{{ else }}}}✓{{{{ end }}}}"'))
    p.append(logs("All session activity", (10, y, 14, 11),
                  f'{APP}{S} | event_name!="faro.performance.resource" | logfmt '
                  f'| line_format "{{{{.kind}}}} {{{{.event_name}}}}{{{{.type}}}} {{{{.message}}}}{{{{.value}}}} {{{{.event_data_toView}}}} {{{{.event_data_http_url}}}}{{{{.event_data_target}}}}"'))
    y += 11
    p.append(panel("table", "Traces (browser → server)", (0, y, 14, 9),
                   [{"datasource": JAEGER, "refId": "A", "queryType": "search", "service": "$app",
                     "tags": "session.id=$session", "limit": 50}], ds=JAEGER,
                   opts={"showHeader": True, "cellHeight": "sm", "sortBy": [{"displayName": "Start time", "desc": False}]}))
    p.append(vitals_table("Web Vitals (worst per page)", (14, y, 10, 9), S, "max_over_time("))
    y += 9
    p.append(logs("Errors and console output", (0, y, 24, 7),
                  f'{APP}{S} | kind=~"exception|log" | logfmt | line_format "[{{{{.kind}}}}] {{{{.level}}}} {{{{.type}}}}{{{{.message}}}}{{{{.value}}}}  ·  {{{{.page_url}}}}"'))
    return p


if __name__ == "__main__":
    out = sys.argv[1]
    links = [{"title": "User Journey", "type": "dashboards", "tags": ["user-journey"], "asDropdown": False,
              "includeVars": False, "keepTime": True}]
    session_var = {"name": "session", "label": "Session ID", "type": "textbox", "query": "",
                   "current": {"text": "", "value": ""}, "hide": 0}
    dashboards = {
        "funnel": dashboard("uj-funnel", "User Journey Funnel", funnel(), variables(), links),
        "session": dashboard("uj-session", "User Journey Session Drilldown", drilldown(), variables([session_var]), links),
    }
    json.dump(dashboards, open(out, "w"), indent=1)
    print({k: len(v["panels"]) for k, v in dashboards.items()})
