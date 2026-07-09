import React, { useState, useEffect } from "react";
import { SvgIcon } from "~/components/ui/SvgIcon";

interface FieldConfig {
  name: string;
  label: string;
  type: "text" | "textarea";
  defaultValue?: string;
}

interface EditModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: Record<string, string>) => Promise<void>;
  fields: FieldConfig[];
  title?: string;
  initialData: Record<string, string>;
  isLoading?: boolean;
}

export function EditModal({
  isOpen,
  onClose,
  onSave,
  fields,
  title = "Edit Content",
  initialData,
  isLoading = false,
}: EditModalProps) {
  const [formData, setFormData] = useState(initialData);

  useEffect(() => {
    if (isOpen) {
      setFormData(initialData);
    }
  }, [isOpen, initialData]);

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>,
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSave = async () => {
    await onSave(formData);
  };

  if (!isOpen) return null;

  return (
    <div className={`modal ${isOpen ? "modal-open" : ""}`}>
      <div className="modal-box max-w-md border-2 border-base-content/20 bg-base-100 p-4 shadow-brutal-sm">
        <h3 className="mb-3 font-heading text-[length:var(--text-md)] font-bold">
          {title}
        </h3>
        <button
          type="button"
          className="btn btn-ghost btn-circle absolute right-2 top-2 h-8 min-h-8 w-8"
          onClick={onClose}
          aria-label="关闭"
        >
          <SvgIcon name="x" size={14} />
        </button>

        <div className="space-y-3">
          {fields.map((field) => {
            const id = `edit-modal-${field.name}`;
            return (
              <div key={field.name} className="form-control gap-1">
                <label htmlFor={id} className="label min-h-0 p-0">
                  <span className="label-text text-[length:var(--text-xs)] font-medium">
                    {field.label}
                  </span>
                </label>
                {field.type === "textarea" ? (
                  <textarea
                    id={id}
                    name={field.name}
                    value={formData[field.name] || ""}
                    onChange={handleChange}
                    className="textarea textarea-bordered input-doodle h-20 min-h-20 text-[length:var(--text-sm)]"
                    rows={4}
                  />
                ) : (
                  <input
                    id={id}
                    type="text"
                    name={field.name}
                    value={formData[field.name] || ""}
                    onChange={handleChange}
                    className="input input-bordered input-doodle h-9 min-h-9 text-[length:var(--text-sm)]"
                  />
                )}
              </div>
            );
          })}
        </div>

        <div className="modal-action mt-4 gap-2">
          <button
            type="button"
            className="btn btn-ghost h-9 min-h-9 px-3 text-[length:var(--text-sm)]"
            onClick={onClose}
          >
            Cancel
          </button>
          <button
            type="button"
            className={`btn btn-primary btn-doodle h-9 min-h-9 px-3 text-[length:var(--text-sm)] ${isLoading ? "loading" : ""}`}
            onClick={handleSave}
            disabled={isLoading}
          >
            {isLoading ? "Saving..." : "Save"}
          </button>
        </div>
      </div>
      <div className="modal-backdrop bg-neutral/45" onClick={onClose} />
    </div>
  );
}
