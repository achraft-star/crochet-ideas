// cPanel/Passenger entry point. Keep server.mjs for local development.
// A CommonJS wrapper also works with Passenger loaders that use require().
import('./server.mjs').catch(error => {
  console.error('Crochet Ideas could not start:', error);
  process.exitCode = 1;
});
