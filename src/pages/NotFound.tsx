import { useEffect } from "react";
import { useTranslation } from "react-i18next";

const NotFound = () => {
  const { t } = useTranslation();

  useEffect(() => {
    window.location.hash = '#/';
  }, []);

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted" dir={document.documentElement.dir || 'rtl'}>
      <div className="text-center">
        <h1 className="mb-4 text-4xl font-bold">{t('notFound.title')}</h1>
        <p className="mb-4 text-xl text-muted-foreground">{t('notFound.message')}</p>
        <a href="#/" className="text-primary underline hover:text-primary/90">{t('notFound.goHome')}</a>
      </div>
    </div>
  );
};

export default NotFound;
