import { setupFeatures } from './setupFeatures'

async function runSetup() {
  console.log('Starting setup...')
  await setupFeatures()
  console.log('Setup completed!')
}

runSetup().catch(console.error) 