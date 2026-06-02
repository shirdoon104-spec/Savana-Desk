"use client";

import { useEffect } from "react";

export function AuthAutocompleteGuard() {
  useEffect(() => {
    function disableAutocomplete() {
      document
        .querySelectorAll<HTMLInputElement>(".auth-page input")
        .forEach((input) => {
          input.setAttribute("autocomplete", "off");
          input.setAttribute("data-lpignore", "true");
          input.setAttribute("data-1p-ignore", "true");
        });
    }

    disableAutocomplete();

    const observer = new MutationObserver(disableAutocomplete);
    observer.observe(document.body, { childList: true, subtree: true });

    return () => observer.disconnect();
  }, []);

  return null;
}
