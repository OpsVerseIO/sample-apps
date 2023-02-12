# OpsVerse Web Frontend Monitoring Sample Application

Sample application with Grafana Faro Integration with OpsVerse ObserveNow stack

**Sample app Tech Stack**

- Svelte + Vite + TS

**How to run**

```
$ npm install
$ Edit `src/App.svelte` to configure your OpsVerse Collector Endpoint and save the file
$ vite dev

// Visit http://localhost:5173 and generate logs, metrics and traces
// which should show up in your ObserveNow Grafana instantly
```