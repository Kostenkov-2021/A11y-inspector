/**
 * Color utility class for accessibility contrast calculations
 * Provides methods for color conversion, contrast checking, and suggestions
 */

class ColorUtils {
  /**
   * Convert HEX color to RGB
   * @param {string} hex - HEX color code
   * @returns {Object} RGB object
   */
  static hexToRgb(hex) {
    // Support for 3-digit and 6-digit HEX
    const shorthandRegex = /^#?([a-f\d])([a-f\d])([a-f\d])$/i;
    hex = hex.replace(shorthandRegex, function(m, r, g, b) {
      return r + r + g + g + b + b;
    });

    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result ? {
      r: parseInt(result[1], 16),
      g: parseInt(result[2], 16),
      b: parseInt(result[3], 16)
    } : { r: 0, g: 0, b: 0 };
  }

/**
 * Convert RGB to HEX
 * @param {number} r - Red value (0-255)
 * @param {number} g - Green value (0-255)
 * @param {number} b - Blue value (0-255)
 * @returns {string} HEX color code
 */
static rgbToHex(r, g, b) {
  // Clamp values to valid range
  const clamp = (value) => Math.max(0, Math.min(255, Math.round(value)));
  
  const hexR = clamp(r).toString(16).padStart(2, '0');
  const hexG = clamp(g).toString(16).padStart(2, '0');
  const hexB = clamp(b).toString(16).padStart(2, '0');
  
  return `#${hexR}${hexG}${hexB}`.toUpperCase();
}

  /**
   * Convert RGB object to CSS string
   * @param {Object} rgb - RGB object
   * @returns {string} CSS rgb() string
   */
  static rgbToString(rgb) {
    return `rgb(${Math.round(rgb.r)}, ${Math.round(rgb.g)}, ${Math.round(rgb.b)})`;
  }

  /**
   * Get WCAG contrast score
   * @param {number} ratio - Contrast ratio
   * @param {number} fontSize - Font size in pixels
   * @param {number} fontWeight - Font weight
   * @returns {string} Contrast score (AAA, AA, Fail)
   */
  static getContrastScore(ratio, fontSize = 16, fontWeight = 400) {
    const isLargeText = fontSize >= 24 || (fontSize >= 18.66 && fontWeight >= 700);
    const aaThreshold = isLargeText ? 3 : 4.5;
    const aaaThreshold = isLargeText ? 4.5 : 7;

    if (ratio >= aaaThreshold) return 'AAA';
    if (ratio >= aaThreshold) return 'AA';
    return 'Fail';
  }

  /**
   * Suggest contrast improvements
   * @param {string} currentColor - Current text color
   * @param {string} backgroundColor - Background color
   * @param {number} targetRatio - Target contrast ratio
   * @returns {Object} Improvement suggestions
   */
  static suggestContrastImprovements(currentColor, backgroundColor, targetRatio) {
    try {
      const currentRgb = this.parseColor(currentColor);
      const backgroundRgb = this.parseColor(backgroundColor);
      
      const currentLuminance = this.getLuminance(currentRgb);
      const backgroundLuminance = this.getLuminance(backgroundRgb);
      
      const currentRatio = this.calculateContrastRatio(currentRgb, backgroundRgb);
      
      // If target ratio already achieved, return current color
      if (currentRatio >= targetRatio) {
        return {
          current: this.rgbToString(currentRgb),
          suggested: this.rgbToString(currentRgb),
          currentRatio: currentRatio,
          suggestedRatio: currentRatio,
          improvement: 'none'
        };
      }
      
      let suggestedRgb;
      let improvement;
      
      if (currentLuminance > backgroundLuminance) {
        // If text is lighter than background - darken
        suggestedRgb = this.findOptimalColor(currentRgb, backgroundRgb, targetRatio, 'darken');
        improvement = 'darken';
      } else {
        // If text is darker than background - lighten
        suggestedRgb = this.findOptimalColor(currentRgb, backgroundRgb, targetRatio, 'lighten');
        improvement = 'lighten';
      }
      
      const suggestedRatio = this.calculateContrastRatio(suggestedRgb, backgroundRgb);
      
      return {
        current: this.rgbToString(currentRgb),
        suggested: this.rgbToString(suggestedRgb),
        currentHex: this.rgbToHex(currentRgb.r, currentRgb.g, currentRgb.b),
        suggestedHex: this.rgbToHex(suggestedRgb.r, suggestedRgb.g, suggestedRgb.b),
        currentRatio: currentRatio,
        suggestedRatio: suggestedRatio,
        improvement: improvement,
        score: this.getContrastScore(suggestedRatio)
      };
    } catch (error) {
      console.error('Error in suggestContrastImprovements:', error);
      return {
        current: currentColor,
        suggested: currentColor,
        currentRatio: 1,
        suggestedRatio: 1,
        improvement: 'error',
        error: error.message
      };
    }
  }

  /**
   * Find optimal color using binary search
   * @param {Object} colorRgb - Original color
   * @param {Object} backgroundRgb - Background color
   * @param {number} targetRatio - Target contrast ratio
   * @param {string} operation - Operation type (darken/lighten)
   * @returns {Object} Optimal RGB color
   */
  static findOptimalColor(colorRgb, backgroundRgb, targetRatio, operation) {
    let optimalColor = { ...colorRgb };
    let currentRatio = this.calculateContrastRatio(optimalColor, backgroundRgb);
    
    // Binary search for optimal color
    let min = 0;
    let max = 1;
    const maxIterations = 20;
    let iteration = 0;
    
    while (iteration < maxIterations && currentRatio < targetRatio) {
      const factor = (min + max) / 2;
      
      let testColor;
      if (operation === 'darken') {
        testColor = this.darkenColor(colorRgb, factor);
      } else {
        testColor = this.lightenColor(colorRgb, factor);
      }
      
      const testRatio = this.calculateContrastRatio(testColor, backgroundRgb);
      
      if (testRatio >= targetRatio) {
        optimalColor = testColor;
        currentRatio = testRatio;
        max = factor; // Reduce factor since we reached target
      } else {
        min = factor; // Increase factor
      }
      
      iteration++;
    }
    
    return optimalColor;
  }

  /**
   * Darken a color
   * @param {Object} color - RGB color object
   * @param {number} factor - Darkening factor (0-1)
   * @returns {Object} Darkened RGB color
   */
  static darkenColor(color, factor) {
    const rgb = this.parseColor(color);
    return {
      r: Math.max(0, rgb.r * (1 - factor)),
      g: Math.max(0, rgb.g * (1 - factor)),
      b: Math.max(0, rgb.b * (1 - factor))
    };
  }

  /**
   * Lighten a color
   * @param {Object} color - RGB color object
   * @param {number} factor - Lightening factor (0-1)
   * @returns {Object} Lightened RGB color
   */
  static lightenColor(color, factor) {
    const rgb = this.parseColor(color);
    return {
      r: Math.min(255, rgb.r + (255 - rgb.r) * factor),
      g: Math.min(255, rgb.g + (255 - rgb.g) * factor),
      b: Math.min(255, rgb.b + (255 - rgb.b) * factor)
    };
  }

  /**
   * Calculate contrast ratio between two colors
   * @param {string|Object} color1 - First color
   * @param {string|Object} color2 - Second color
   * @returns {number} Contrast ratio
   */
  static calculateContrastRatio(color1, color2) {
    const lum1 = this.getLuminance(color1);
    const lum2 = this.getLuminance(color2);
    
    const lighter = Math.max(lum1, lum2);
    const darker = Math.min(lum1, lum2);
    
    return (lighter + 0.05) / (darker + 0.05);
  }

  /**
   * Calculate relative luminance of a color (WCAG formula)
   * @param {string|Object} color - Color to calculate luminance for
   * @returns {number} Relative luminance (0-1)
   */
  static getLuminance(color) {
    const rgb = this.parseColor(color);
    
    const [r, g, b] = [rgb.r, rgb.g, rgb.b].map(component => {
      component = component / 255;
      return component <= 0.03928 
        ? component / 12.92 
        : Math.pow((component + 0.055) / 1.055, 2.4);
    });

    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  }

  /**
   * Parse color from various formats
   * @param {string|Object} color - Color to parse
   * @returns {Object} RGB color object
   */
  static parseColor(color) {
    if (typeof color === 'object' && color.r !== undefined && color.g !== undefined && color.b !== undefined) {
      return color;
    }
    
    if (typeof color === 'string') {
      if (color.startsWith('rgb')) {
        return this.parseRgbColor(color);
      } else if (color.startsWith('#')) {
        return this.parseHexColor(color);
      }
    }
    
    // Fallback to black
    return { r: 0, g: 0, b: 0 };
  }

  /**
   * Parse RGB color string
   * @param {string} color - RGB color string
   * @returns {Object} RGB color object
   */
  static parseRgbColor(color) {
    // Support for rgb and rgba
    const match = color.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*[\d.]+)?\)/i);
    if (match) {
      return {
        r: parseInt(match[1]),
        g: parseInt(match[2]),
        b: parseInt(match[3])
      };
    }
    return { r: 0, g: 0, b: 0 };
  }

  /**
   * Parse HEX color string
   * @param {string} hex - HEX color string
   * @returns {Object} RGB color object
   */
  static parseHexColor(hex) {
    return this.hexToRgb(hex);
  }

  /**
   * Check if color is light
   * @param {string|Object} color - Color to check
   * @returns {boolean} True if color is light
   */
  static isLightColor(color) {
    const rgb = this.parseColor(color);
    const luminance = this.getLuminance(rgb);
    return luminance > 0.5;
  }

  /**
   * Check if color is dark
   * @param {string|Object} color - Color to check
   * @returns {boolean} True if color is dark
   */
  static isDarkColor(color) {
    return !this.isLightColor(color);
  }

  /**
   * Get readable text color for background
   * @param {string} backgroundColor - Background color
   * @returns {string} Recommended text color (black or white)
   */
  static getReadableTextColor(backgroundColor) {
    const bgRgb = this.parseColor(backgroundColor);
    const bgLuminance = this.getLuminance(bgRgb);
    
    // Choose black or white text based on background luminance
    return bgLuminance > 0.5 ? '#000000' : '#FFFFFF';
  }

  /**
   * Generate accessible color palette from base color
   * @param {string} baseColor - Base color
   * @returns {Object} Color palette with variants
   */
  static generateAccessibleColorPalette(baseColor) {
    const baseRgb = this.parseColor(baseColor);
    
    return {
      primary: this.rgbToString(baseRgb),
      light: this.rgbToString(this.lightenColor(baseRgb, 0.3)),
      dark: this.rgbToString(this.darkenColor(baseRgb, 0.3)),
      complementary: this.rgbToString(this.getComplementaryColor(baseRgb)),
      textOnLight: '#000000',
      textOnDark: '#FFFFFF'
    };
  }

  /**
   * Get complementary color
   * @param {string|Object} color - Original color
   * @returns {Object} Complementary RGB color
   */
  static getComplementaryColor(color) {
    const rgb = this.parseColor(color);
    return {
      r: 255 - rgb.r,
      g: 255 - rgb.g,
      b: 255 - rgb.b
    };
  }

  /**
   * Simulate color blindness
   * @param {string|Object} color - Original color
   * @param {string} type - Type of color blindness
   * @returns {Object} Simulated RGB color
   */
  static simulateColorBlindness(color, type = 'deuteranopia') {
    const rgb = this.parseColor(color);
    
    // Transformation matrices for different color blindness types
    const matrices = {
      protanopia: [
        [0.567, 0.433, 0],
        [0.558, 0.442, 0],
        [0, 0.242, 0.758]
      ],
      deuteranopia: [
        [0.625, 0.375, 0],
        [0.7, 0.3, 0],
        [0, 0.3, 0.7]
      ],
      tritanopia: [
        [0.95, 0.05, 0],
        [0, 0.433, 0.567],
        [0, 0.475, 0.525]
      ]
    };
    
    const matrix = matrices[type] || matrices.deuteranopia;
    
    const r = rgb.r * matrix[0][0] + rgb.g * matrix[0][1] + rgb.b * matrix[0][2];
    const g = rgb.r * matrix[1][0] + rgb.g * matrix[1][1] + rgb.b * matrix[1][2];
    const b = rgb.r * matrix[2][0] + rgb.g * matrix[2][1] + rgb.b * matrix[2][2];
    
    return {
      r: Math.min(255, Math.max(0, r)),
      g: Math.min(255, Math.max(0, g)),
      b: Math.min(255, Math.max(0, b))
    };
  }
}

// Export for use in other files
if (typeof module !== 'undefined' && module.exports) {
  module.exports = ColorUtils;
} else {
  window.ColorUtils = ColorUtils;
}