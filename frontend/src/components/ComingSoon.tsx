import { Construction } from "lucide-react";

interface ComingSoonProps {
  pageName?: string;
}

export default function ComingSoon({ pageName }: ComingSoonProps) {
  return (
    <div className="flex flex-col items-center justify-center flex-1 gap-4 p-8 text-center min-h-[60vh]">
      <div className="rounded-full bg-slate-100 p-5">
        <Construction className="h-10 w-10 text-slate-400" />
      </div>
      <div>
        <h2 className="text-xl font-semibold text-slate-800">
          {pageName ?? "This page"} is coming soon
        </h2>
        <p className="mt-1 text-sm text-slate-500 max-w-xs">
          This section is under construction. Check back later.
        </p>
      </div>
    </div>
  );
}
