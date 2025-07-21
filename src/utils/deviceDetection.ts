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
 * Detects if the current device is a mobile device
 * Uses multiple methods for better accuracy
 */
export const isMobileDevice = (): boolean => {
  // Method 1: Check navigator.userAgentData (newer API)
  if ('userAgentData' in navigator) {
    return (navigator as any).userAgentData.mobile === true;
  }

  // Method 2: Check userAgent string
  const userAgent = navigator.userAgent.toLowerCase();
  const mobileKeywords = [
    'android',
    'webos',
    'iphone',
    'ipad',
    'ipod',
    'blackberry',
    'windows phone',
    'mobile',
    'tablet'
  ];
  
  const isMobileUserAgent = mobileKeywords.some(keyword => userAgent.includes(keyword));

  // Method 3: Check screen size
  const isMobileScreen = window.innerWidth <= 768 || window.innerHeight <= 768;

  // Method 4: Check touch support
  const hasTouchSupport = 'ontouchstart' in window || navigator.maxTouchPoints > 0;

  // Method 5: Check orientation (mobile devices have this)
  const hasOrientation = 'orientation' in window;

  // Combine checks - if at least 2 methods indicate mobile, consider it mobile
  const checks = [isMobileUserAgent, isMobileScreen, hasTouchSupport, hasOrientation];
  const mobileIndicators = checks.filter(check => check).length;

  return mobileIndicators >= 2;
};

/**
 * Detects if the device is a tablet specifically
 */
export const isTablet = (): boolean => {
  const userAgent = navigator.userAgent.toLowerCase();
  const isIPad = userAgent.includes('ipad') || 
    (userAgent.includes('macintosh') && 'ontouchend' in document);
  const isAndroidTablet = userAgent.includes('android') && !userAgent.includes('mobile');
  
  return isIPad || isAndroidTablet;
};

/**
 * Get device type as a string
 */
export const getDeviceType = (): 'mobile' | 'tablet' | 'desktop' => {
  if (isTablet()) return 'tablet';
  if (isMobileDevice()) return 'mobile';
  return 'desktop';
}; 