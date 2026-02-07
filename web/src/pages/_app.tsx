import type { AppProps } from "next/app";
import { Space_Grotesk } from "next/font/google";

const space = Space_Grotesk({ subsets: ["latin"], variable: "--font-space" });

export default function App({ Component, pageProps }: AppProps) {
  return (
    <div className={space.className}>
      <Component {...pageProps} />
    </div>
  );
}
