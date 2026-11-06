import {
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";

/** One short flourish when it enters view; content and controls are always ready. */
export function useInkEntrance<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [entered, setEntered] = useState(false);
  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) {
        setEntered(true);
        observer.disconnect();
      }
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, []);
  return { ref, entered };
}

export default function InkEntrance({
  children,
  className = "",
  style,
}: {
  children: ReactNode;
  className?: string;
  style?: CSSProperties;
}) {
  const { ref, entered } = useInkEntrance<HTMLDivElement>();
  return (
    <div
      ref={ref}
      className={`${className}${entered ? " ink-entered" : ""}`}
      style={style}
    >
      {children}
    </div>
  );
}
