import { LoadingPage } from "./LoadingPage";

export function AlbumWaits() {
  return (
    <main aria-busy="true" className="mx-auto w-full max-w-6xl flex-1 px-4 pb-16 pt-6 md:px-6 md:pt-8">
      <LoadingPage />
    </main>
  );
}
