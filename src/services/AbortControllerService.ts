/*
 * Copyright © 2025 Dell Inc. or its subsidiaries. All Rights Reserved.

 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *      http://www.apache.org/licenses/LICENSE-2.0
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

/**
 * Service to manage AbortControllers outside of Redux state
 * This avoids the non-serializable warning from Redux
 */
class AbortControllerService {
  private currentController: AbortController | null = null;

  /**
   * Create and store a new AbortController
   * @returns The AbortController instance
   */
  createController(): AbortController {
    // Abort any existing controller
    this.abort();
    
    // Create new controller
    this.currentController = new AbortController();
    return this.currentController;
  }

  /**
   * Get the current AbortController
   * @returns The current AbortController or null
   */
  getCurrentController(): AbortController | null {
    return this.currentController;
  }

  /**
   * Abort the current controller and clear it
   */
  abort(): void {
    if (this.currentController) {
      this.currentController.abort();
      this.currentController = null;
    }
  }

  /**
   * Clear the current controller without aborting
   */
  clear(): void {
    this.currentController = null;
  }
}

// Export singleton instance
export const abortControllerService = new AbortControllerService(); 