import { css } from "@emotion/react";
import Button from "./button.js";

const DialogFooter = ({
  cancel,
  cancelButtonLabel,
  submit,
  submitButtonLabel,
  submitButtonProps,
}) => (
  <footer
    css={css({
      display: "flex",
      justifyContent: "flex-end",
      paddingTop: "2.5rem",
      "@media (min-width: 600px)": {
        paddingTop: "3rem",
      },
    })}
  >
    <div
      css={css({
        display: "grid",
        gridAutoFlow: "column",
        gridAutoColumns: "minmax(0,1fr)",
        gridGap: "1rem",
      })}
    >
      {cancel != null && (
        <Button type="button" size="medium" onClick={cancel}>
          {cancelButtonLabel}
        </Button>
      )}
      {submit != null && (
        <Button size="medium" variant="primary" {...submitButtonProps}>
          {submitButtonLabel}
        </Button>
      )}
    </div>
  </footer>
);

export default DialogFooter;
