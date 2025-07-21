import { defineConfig } from '@playwright/test';

/**
 * Playwright configuration for Docker integration tests
 */
export default defineConfig({
  testDir: './tests/e2e',
  testMatch: 'docker-db-integration.spec.ts',
  /* Maximum time one test can run for. */
  timeout: 60 * 1000,
  
  /* Run tests in files in parallel */
  fullyParallel: false, // Sequential is better for Docker tests
  
  /* Configure retries - useful for Docker tests that might have timing issues */
  retries: 1,
  
  /* Reporter to use. */
  reporter: [
    ['html', { open: 'never' }],
    ['list', { printSteps: true }]
  ],
  
  /* Shared settings for all the projects below */
  use: {
    /* Maximum time each action (like clicking) can take. */
    actionTimeout: 20000,
    
    /* Collect trace when test fails. */
    trace: 'on-first-retry',
    
    /* Take screenshots on failure */
    screenshot: 'only-on-failure',
    
    /* Record video on failure */
    video: 'on-first-retry',
  },
  
  /* Configure projects for the different browsers */
  projects: [
    {
      name: 'chromium',
      use: {
        browserName: 'chromium',
        headless: true,
        viewport: { width: 1280, height: 720 },
        baseURL: 'http://localhost:5173',
      },
    }
  ],
  
  /* Run local dev server before starting the tests */
  webServer: {
    command: 'yarn dev',
    url: 'http://localhost:5173',
    reuseExistingServer: true,
    stdout: 'pipe',
    stderr: 'pipe',
  },
}); 