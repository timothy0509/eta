import { Suspense } from "react";

import HomeClient from "./home-client";
import { HomeLoading } from "./home-loading";

export default function Home() {
  return (
    <Suspense fallback={<HomeLoading />}>
      <HomeClient />
    </Suspense>
  );
}
