import { Suspense } from "react";

import HomeClient from "./home-client";

export default function Home() {
  return (
    <Suspense>
      <HomeClient />
    </Suspense>
  );
}
