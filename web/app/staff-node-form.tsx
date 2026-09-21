"use client";

export type StaffOption = {
  value: string;
  label: string;
  default?: boolean;
  optInAnonymous?: boolean;
  keepRole?: boolean;
};

export type StaffNode = {
  id: string;
  type: string;
  prompt: string;
  required?: boolean;
  requiredMode?: string;
  options?: StaffOption[];
  fields?: Array<{ key: string; label: string; type: string; required?: boolean }>;
  softEscape?: { enabled?: boolean; labels?: string[] };
  productNameFollowUp?: { prompt?: string; skipForOptions?: string[]; otherRule?: { optionMatches?: string[] } };
  workPhoneRequired?: boolean;
  workPhoneSoftOptional?: boolean;
  defaultAnonymity?: string;
};

function selectedList(value: string) {
  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function ChipRow({
  options,
  value,
  onChange,
  multi = false,
}: {
  options: StaffOption[];
  value: string;
  onChange: (next: string) => void;
  multi?: boolean;
}) {
  const selected = multi ? selectedList(value) : [];
  return (
    <div className="chip-row">
      {options.map((option) => {
        const active = multi ? selected.includes(option.value) || selected.includes(option.label) : value === option.value || value === option.label;
        return (
          <button
            key={option.value}
            className={active ? "chip chip-active" : "chip"}
            onClick={() => {
              if (!multi) {
                onChange(option.value);
                return;
              }
              const current = selected.includes(option.value)
                ? selected.filter((item) => item !== option.value)
                : [...selected, option.value];
              onChange(current.join(", "));
            }}
            type="button"
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}

export function StaffNodeForm({
  node,
  fields,
  loading,
  onField,
  onSubmit,
}: {
  node: StaffNode;
  fields: Record<string, string>;
  loading: boolean;
  onField: (key: string, value: string) => void;
  onSubmit: (payload: Record<string, unknown>, content: string) => void;
}) {
  const options = node.options || [];
  const follow = node.productNameFollowUp;
  const selected = selectedList(fields.answer || "");
  const skipFollow = new Set(follow?.skipForOptions || ["Prefer not to say"]);
  const productNames = (() => {
    try {
      const parsed = JSON.parse(fields.product_names || "{}") as Record<string, string>;
      return parsed && typeof parsed === "object" ? parsed : {};
    } catch {
      return {};
    }
  })();

  function setProductName(category: string, value: string) {
    onField("product_names", JSON.stringify({ ...productNames, [category]: value }));
  }

  function submitAnswer(answer = fields.answer || "", extra: Record<string, unknown> = {}, content = answer) {
    onSubmit({ answer, ...extra }, content);
  }

  if (node.type === "terminal") {
    return (
      <div className="stack">
        <p className="success-copy">{node.prompt}</p>
        <p className="muted-copy">Filed to your company’s ROIA workspace. Portal comes later.</p>
      </div>
    );
  }

  if (node.type === "cta") {
    return (
      <div className="stack">
        <p className="muted-copy">{node.prompt}</p>
        <button
          className="primary-button"
          disabled={loading}
          onClick={() => submitAnswer(options[0]?.value || "Begin discovery")}
          type="button"
        >
          {loading ? "Starting…" : options[0]?.label || "Begin discovery"}
        </button>
      </div>
    );
  }

  if (node.type === "contact") {
    const phoneRequired = Boolean(node.workPhoneRequired);
    const canContinue = Boolean((fields.full_name || "").trim() && (fields.email || "").trim() && (!phoneRequired || (fields.work_phone || "").trim()));
    return (
      <div className="stack">
        <label className="field-group">
          <span className="field-label">Your name</span>
          <input className="text-input" onChange={(event) => onField("full_name", event.target.value)} value={fields.full_name || ""} />
        </label>
        <label className="field-group">
          <span className="field-label">Work email</span>
          <input className="text-input" onChange={(event) => onField("email", event.target.value)} type="email" value={fields.email || ""} />
        </label>
        <label className="field-group">
          <span className="field-label">{phoneRequired ? "Work phone" : "Work phone (optional)"}</span>
          <input className="text-input" onChange={(event) => onField("work_phone", event.target.value)} value={fields.work_phone || ""} />
        </label>
        {node.workPhoneSoftOptional ? (
          <p className="hint-copy">House or personal phones are fine to skip if that’s friction.</p>
        ) : null}
        <button
          className="primary-button"
          disabled={loading || !canContinue}
          onClick={() =>
            submitAnswer(
              `${fields.full_name || ""} | ${fields.email || ""}`,
              {
                full_name: fields.full_name || "",
                name: fields.full_name || "",
                email: fields.email || "",
                work_phone: fields.work_phone || "",
                workPhone: fields.work_phone || "",
              },
              `${fields.full_name || ""} | ${fields.email || ""}`,
            )
          }
          type="button"
        >
          Continue
        </button>
      </div>
    );
  }

  if (node.type === "summary") {
    return (
      <div className="stack">
        <p className="muted-copy">{node.prompt}</p>
        <label className="field-group">
          <span className="field-label">Your discovery summary</span>
          <textarea
            className="text-area text-area-large"
            onChange={(event) => onField("summary", event.target.value)}
            rows={10}
            value={fields.summary || ""}
          />
        </label>
        <div className="action-row">
          <button className="secondary-button" disabled={loading} onClick={() => submitAnswer("Edit answers")} type="button">
            Edit answers
          </button>
          <button className="primary-button" disabled={loading} onClick={() => submitAnswer("Looks good — submit")} type="button">
            {loading ? "Sending…" : "Looks good — submit"}
          </button>
        </div>
      </div>
    );
  }

  if (node.type === "short") {
    return (
      <div className="stack">
        <label className="field-group">
          <span className="field-label">{node.prompt}</span>
          <input className="text-input" onChange={(event) => onField("answer", event.target.value)} value={fields.answer || ""} />
        </label>
        <button className="primary-button" disabled={loading} onClick={() => submitAnswer(fields.answer || "")} type="button">
          Continue
        </button>
      </div>
    );
  }

  if (node.type === "paragraph") {
    const escapeLabels = node.softEscape?.labels || [];
    return (
      <div className="stack">
        <label className="field-group">
          <span className="field-label">{node.prompt}</span>
          <textarea className="text-area" onChange={(event) => onField("answer", event.target.value)} rows={5} value={fields.answer || ""} />
        </label>
        <div className="action-row">
          {escapeLabels.map((label) => (
            <button key={label} className="secondary-button" disabled={loading} onClick={() => submitAnswer(label)} type="button">
              {label}
            </button>
          ))}
          <button className="primary-button" disabled={loading} onClick={() => submitAnswer(fields.answer || "")} type="button">
            Continue
          </button>
        </div>
      </div>
    );
  }

  if (node.type === "checkbox") {
    const option = options[0];
    const checked = Boolean(fields.answer);
    return (
      <div className="stack">
        <p className="field-label">{node.prompt}</p>
        <ChipRow
          options={options}
          value={checked ? option?.value || "" : ""}
          onChange={(next) => onField("answer", next && next === fields.answer ? "" : next)}
        />
        <button className="primary-button" disabled={loading} onClick={() => submitAnswer(fields.answer || "")} type="button">
          Continue
        </button>
      </div>
    );
  }

  if (node.type === "checkboxes" || node.type === "mc") {
    const followCategories = follow ? selected.filter((item) => !skipFollow.has(item)) : [];
    const missingProduct = followCategories.some((category) => !(productNames[category] || "").trim());
    const defaultMc = node.id === "Q4c" && !fields.answer ? node.defaultAnonymity || "named" : fields.answer || "";
    return (
      <div className="stack">
        <div className="field-group">
          <span className="field-label">{node.prompt}</span>
          <ChipRow
            multi={node.type === "checkboxes"}
            onChange={(next) => onField("answer", next)}
            options={options}
            value={node.type === "mc" ? defaultMc : fields.answer || ""}
          />
        </div>
        {followCategories.map((category) => (
          <label className="field-group" key={category}>
            <span className="field-label">{follow?.prompt || "Type the product name."} — {category}</span>
            <input
              className="text-input"
              onChange={(event) => setProductName(category, event.target.value)}
              value={productNames[category] || ""}
            />
          </label>
        ))}
        {node.id === "Q4c" ? (
          <p className="hint-copy">Named is the default. Anonymous still keeps your role.</p>
        ) : null}
        <button
          className="primary-button"
          disabled={loading || (node.required && node.type === "checkboxes" && !selected.length) || missingProduct}
          onClick={() =>
            submitAnswer(node.type === "mc" ? defaultMc : fields.answer || "", {
              staff_role: node.id === "Q4" ? defaultMc || fields.answer : undefined,
              role: node.id === "Q4" ? defaultMc || fields.answer : undefined,
              anonymity: node.id === "Q4c" ? defaultMc : undefined,
              product_names: follow ? productNames : undefined,
            })
          }
          type="button"
        >
          Continue
        </button>
      </div>
    );
  }

  return (
    <div className="stack">
      <p className="muted-copy">{node.prompt}</p>
      <button className="primary-button" disabled={loading} onClick={() => submitAnswer("Continue")} type="button">
        Continue
      </button>
    </div>
  );
}
