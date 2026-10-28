/**
 * Full-screen, read-only reading surface shared by the import panel's previews (a picked
 * pack, the AI prompt kit): title row with a close button, a body that fills the rest of
 * the screen, and an optional footer action.
 *
 * Exports: FullscreenSheet
 * Depends on: @radix-ui/react-dialog, ../lib/ui-copy, ../lib/useLocale, vocabulary.css (.vocab-preview*)
 */
import type { ReactNode } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import { t } from "../lib/ui-copy";
import { useLocale } from "../lib/useLocale";

export function FullscreenSheet({
  open,
  onOpenChange,
  icon,
  title,
  subtitle,
  footer,
  children,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  icon: ReactNode;
  title: string;
  subtitle?: string;
  footer?: ReactNode;
  children: ReactNode;
}) {
  const ui = useLocale();
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Content className="vocab-preview" aria-describedby={undefined}>
          <header className="vocab-preview-top">
            {icon}
            <div className="vocab-preview-heading">
              <Dialog.Title>{title}</Dialog.Title>
              {subtitle && <p>{subtitle}</p>}
            </div>
            <Dialog.Close className="vocab-preview-close" aria-label={t(ui, "common.close")}>
              <X size={18} />
            </Dialog.Close>
          </header>
          {children}
          {footer && <footer className="vocab-preview-foot">{footer}</footer>}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
