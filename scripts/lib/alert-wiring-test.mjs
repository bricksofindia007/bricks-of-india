// TEMPORARY (remove before merge): one deliberate test alert through the shared alert module.
import { sendAlert } from './alert.mjs';

const stamp = new Date().toISOString();
await sendAlert(
  `TEST alert wiring ${stamp}`,
  `Deliberate test of the alert path (generator wiring). Sent ${stamp} from workflow run ${process.env.GITHUB_RUN_ID ?? 'local'}.`,
);
