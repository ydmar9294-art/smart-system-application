import { useEffect, useState } from 'react';
import { Capacitor } from '@capacitor/core';
import { Keyboard } from '@capacitor/keyboard';

export const useKeyboard = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [keyboardHeight, setKeyboardHeight] = useState(0);

  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;

    const showListener = Keyboard.addListener('keyboardWillShow', (info) => {
      setIsOpen(true);
      setKeyboardHeight(info.keyboardHeight);
    });

    const hideListener = Keyboard.addListener('keyboardWillHide', () => {
      setIsOpen(false);
      setKeyboardHeight(0);
    });

    return () => {
      showListener.then(l => l.remove());
      hideListener.then(l => l.remove());
    };
  }, []);

  const hide = async () => {
    if (Capacitor.isNativePlatform()) {
      await Keyboard.hide();
    }
  };

  const show = async () => {
    if (Capacitor.isNativePlatform()) {
      await Keyboard.show();
    }
  };

  return { isOpen, keyboardHeight, hide, show };
};
