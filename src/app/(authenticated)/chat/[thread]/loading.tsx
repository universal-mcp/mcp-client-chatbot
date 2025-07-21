import { Loader } from "lucide-react";

export default function Loading() {
  return (
    <div className="flex items-center justify-center h-full">
      <Loader className="size-5 animate-spin" />
    </div>
  );
}
