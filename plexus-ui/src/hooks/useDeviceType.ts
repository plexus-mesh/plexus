import { useState, useEffect } from "react";

export function useDeviceType() {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const checkMobile = () => {
      // Check for mobile user agent or small screen width
      const userAgent =
        typeof window.navigator === "undefined" ? "" : navigator.userAgent;
      const mobileRegex =
        /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i;
      const isMobileUA = mobileRegex.test(userAgent);

      // Also check width (Tailwind md breakpoint is 768px)
      const isSmallScreen = window.innerWidth < 768;

      setIsMobile(isMobileUA || isSmallScreen);
    };

    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, []);

  return { isMobile };
}
