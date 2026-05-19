import { useEffect, useState } from "react";

/** Совпадает с `@media (max-width: 767px)` в KpPage.css */
export function useKpNarrowViewport() {
  const [narrow, setNarrow] = useState(false);

  useEffect(() => {
    const mediaQuery = window.matchMedia("(max-width: 767px)");
    const handleChange = () => setNarrow(mediaQuery.matches);
    handleChange();
    mediaQuery.addEventListener("change", handleChange);
    return () => mediaQuery.removeEventListener("change", handleChange);
  }, []);

  return narrow;
}
