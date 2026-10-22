import { SnowflakeIcon } from "../../components/icons";

export default function AuthBrand() {
  return (
    <div className="mb-6 flex items-center gap-2">
      <span className="grid h-8 w-8 place-items-center rounded-md bg-motive-blue text-white">
        <SnowflakeIcon className="h-4 w-4" />
      </span>
      <span className="text-lg font-semibold tracking-tight text-motive-ink">coldchain</span>
    </div>
  );
}
