/**
 * LanguageSwitcher — DEPRECATED (Arabic-only mode).
 * 
 * Kept as a no-op for backward compatibility with any code that still
 * imports it. Renders nothing.
 */
import React from 'react';

interface LanguageSwitcherProps {
  open?: boolean;
  onClose?: () => void;
}

const LanguageSwitcher: React.FC<LanguageSwitcherProps> = () => null;

export default LanguageSwitcher;
