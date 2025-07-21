// reactPolyfill.js
import * as ReactImport from 'react';

// Make a copy of React to modify
const React = { ...ReactImport };

// Add Children API if missing
if (!React.Children) {
  React.Children = {
    map: function(children, func) {
      return Array.isArray(children) ? children.map(func) : (children ? [func(children)] : []);
    },
    forEach: function(children, func) {
      if (Array.isArray(children)) children.forEach(func);
      else if (children) func(children);
    },
    count: function(children) {
      return children ? (Array.isArray(children) ? children.length : 1) : 0;
    },
    only: function(children) {
      if (!children) throw new Error('React.Children.only expected to receive a single React element child.');
      return Array.isArray(children) ? children[0] : children;
    },
    toArray: function(children) {
      return Array.isArray(children) ? children : (children ? [children] : []);
    }
  };
}

// Make React available globally
window.React = React;

// Polyfill for process 
if (typeof window !== 'undefined' && !window.process) {
  window.process = {
    env: {},
    version: 'v16.0.0',
    platform: 'browser',
    nextTick: cb => setTimeout(cb, 0)
  };
}

// Fix for some library Buffer usage in browser environments
if (typeof window !== 'undefined' && !window.Buffer) {
  // Create Buffer as a constructor function
  function BufferPolyfill(arg) {
    // Handle different input types
    if (typeof arg === 'number') {
      this.length = arg;
      this._data = new Uint8Array(arg);
    } else if (typeof arg === 'string') {
      const encoder = new TextEncoder();
      this._data = encoder.encode(arg);
      this.length = this._data.length;
    } else if (arg instanceof Uint8Array || arg instanceof ArrayBuffer) {
      this._data = arg instanceof ArrayBuffer ? new Uint8Array(arg) : arg;
      this.length = this._data.length;
    } else {
      this._data = new Uint8Array(0);
      this.length = 0;
    }
  }

  // Static methods
  BufferPolyfill.isBuffer = function(obj) {
    return obj instanceof BufferPolyfill;
  };

  BufferPolyfill.byteLength = function(str, encoding) {
    if (typeof str !== 'string') {
      if (str instanceof ArrayBuffer) return str.byteLength;
      if (ArrayBuffer.isView(str)) return str.byteLength;
      str = String(str);
    }
    
    if (str.length === 0) return 0;
    
    if (typeof TextEncoder !== 'undefined') {
      return new TextEncoder().encode(str).length;
    }
    
    // Fallback approximation for ASCII
    return str.length;
  };

  BufferPolyfill.from = function(value, encodingOrOffset, length) {
    return new BufferPolyfill(value);
  };

  // Instance methods
  BufferPolyfill.prototype.toString = function(encoding) {
    if (typeof TextDecoder !== 'undefined') {
      return new TextDecoder().decode(this._data);
    }
    return '';
  };

  // Assign to global
  window.Buffer = BufferPolyfill;
}

// Fix TextEncoder/TextDecoder for older browsers
if (typeof window !== 'undefined') {
  if (typeof window.TextEncoder === 'undefined') {
    window.TextEncoder = function TextEncoder() {};
    window.TextEncoder.prototype.encode = function encode() {
      return [];
    };
  }
  
  if (typeof window.TextDecoder === 'undefined') {
    window.TextDecoder = function TextDecoder() {};
    window.TextDecoder.prototype.decode = function decode() {
      return '';
    };
  }
}