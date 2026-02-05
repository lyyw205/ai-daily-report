import dotenv from 'dotenv';
import { runDaily } from '../lib/pipeline/runDaily';

dotenv.config({ path: '.env.local' });

const main = async () => {
  const result = await runDaily();
  console.log(JSON.stringify(result.stats, null, 2));
};

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
