import { useEffect } from "react";

const NotFound = () => {
  useEffect(() => {
    // Redirect to home for hash-based routing compatibility
    window.location.hash = '#/';
  }, []);

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted" dir="rtl">
      <div className="text-center">
        <h1 className="mb-4 text-4xl font-bold">404</h1>
        <p className="mb-4 text-xl text-muted-foreground">الصفحة غير موجودة</p>
        <a href="#/" className="text-primary underline hover:text-primary/90">
          العودة للرئيسية
        </a>
      </div>
    </div>
  );
};

export default NotFound;
