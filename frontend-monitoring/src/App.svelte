<script lang="ts">
  import { TracingInstrumentation } from '@grafana/faro-web-tracing';
  import { initializeFaro, getWebInstrumentations, LogLevel } from '@grafana/faro-web-sdk';
  
  let value = "https://frontend-opsverse-venus.observe.devopsnow.cloud/collect";

  let faro = initializeFaro({
    url: value,
    instrumentations: [...getWebInstrumentations({captureConsole: true, captureConsoleDisabledLevels: [LogLevel.DEBUG]}), new TracingInstrumentation()],
    app: {
      name: 'frontend',
      version: '1.0.0',
    },
  });
    
  // Test Log Ingestion into Opsverse Observe
  const createLog = () => {
    //console.info(`This sample log was generated at: ${ new Date().toLocaleString() }`)
    console.log("Hey there, I'm a log in the browser console!")
    console.error("Oh no, looks like something errored out")
    console.info("And here is a \"console.info\" that may be useful to you")
  }

  // Test Tracing Ingestion into Opsverse Observe
  const { trace, context } = faro.api.getOTEL();

  const tracer = trace.getTracer('default');

  const createTrace = () => {
    const span = tracer.startSpan('test-span');
    context.with(trace.setSpan(context.active(), span), () => {
      //console.log("Inside a span!");

      setTimeout(() => {
        //console.info(`This sample trace was generated at: ${ new Date().toLocaleString() }`); 
        span.end() 
      }, 2000);
    });
  }

  const processData = () => {
    const span = tracer.startSpan('process-data');
    context.with(trace.setSpan(context.active(), span), () => {
      setTimeout(() => { alert("Processed User Action"); span.end();}, 1000)
    });
  }
  
  const getMoreData = () => {
    const span = tracer.startSpan('get-more-data');
    context.with(trace.setSpan(context.active(), span), () => {
      fetch("http://localhost:5000/rolldice").then(
        () =>  { processData(); 
        span.end();
        });
    });
  }
  
  const getData = () => {
    const span = tracer.startSpan('get-data');
    context.with(trace.setSpan(context.active(), span), () => {
      fetch("http://localhost:5000/user_info").then(
        () =>  { getMoreData() 
        span.end();
        });
    });
  }
  const moveAround = () => {
    const span = tracer.startSpan('user-action')
    context.with(trace.setSpan(context.active(), span), () => {
       getData();
       span.end();
    });
  }

  const generateError = () => {
    throw new Error("Some Error Happened Here!")
  }

  //setTimeout(moveAround,5000);

</script>

<main>
  <div class="info">Currently pushing telemetry to <b> { value } </b></div>
  <div>
    <a href="https://opsverse.io" target="_blank" rel="noreferrer"> 
      <img src="/logo.png" class="logo" alt="OpsVerse Logo" />
    </a>
  </div>
  <h1>OpsVerse Frontend Monitoring Demo</h1>

  <div class="card">
    
<button on:click={createLog}>Generate Sample Log</button>
<button on:click={createTrace}>Generate Sample Trace</button>
<button on:click={moveAround}>Data Processing</button>
<button on:click={generateError}>Generate Error</button>
  </div>
  <p class="text">
    Click on the Buttons above to create dummy logs and traces
  </p>
</main>

<style>
  .logo {
    height: 6em;
    padding: 1.5em;
    will-change: filter;
  }
  .logo:hover {
    filter: drop-shadow(0 0 2em #646cffaa);
  }
  .info {
    position: fixed;
    left: 1%;
    font-size: 14px;
    top: 1%;
    color: #0ad;
  }
</style>
