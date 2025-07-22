import { Loader } from "lucide-react";

export default function Loading() {
  return (
    <div className="flex h-full w-full items-center justify-center">
      <Loader className="size-5 animate-spin" />
    </div>
  );
}
