import React from 'react';

interface AuthOverlayProps {
  visible: boolean;
}

/**
 * Full-screen blur overlay that appears when OAuth browser is open.
 * Creates the illusion that the Custom Tab is part of the app.
 */
const AuthOverlay: React.FC<AuthOverlayProps> = ({ visible }) => {
  if (!visible) return null;

  return (
    <div className="auth-overlay-backdrop">
      {/* Animated orbs for depth */}
      <div className="auth-overlay-orb auth-overlay-orb-1" />
      <div className="auth-overlay-orb auth-overlay-orb-2" />
      <div className="auth-overlay-orb auth-overlay-orb-3" />
    </div>
  );
};

export default AuthOverlay;
