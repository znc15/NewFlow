import { syncUpstreamSkills } from '../src/infrastructure/upstream-skills';

syncUpstreamSkills(process.cwd(), (message) => {
  process.stdout.write(`${message}\n`);
});
