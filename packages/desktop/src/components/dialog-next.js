import React from "react";
import { css, useTheme } from "@emotion/react";
import {
  FocusScope,
  OverlayContainer,
  useDialog,
  useModal,
  useOverlay,
  usePreventScroll,
} from "react-aria";

const Dialog = ({
  transparent,
  underlayProps: customUnderlayProps,
  dialogElementProps,
  ...props
}) => {
  const { children } = props;

  // Handle interacting outside the dialog and pressing
  // the Escape key to close the modal.
  const ref = React.useRef();
  const { overlayProps, underlayProps } = useOverlay(props, ref);

  // Prevent scrolling while the modal is open, and hide content
  // outside the modal from screen readers.
  usePreventScroll();
  const { modalProps } = useModal();

  // Get props for the dialog and its title
  const { dialogProps, titleProps } = useDialog(props, ref);

  return (
    <div
      {...customUnderlayProps}
      css={css(
        {
          position: "fixed",
          zIndex: 10,
          top: 0,
          left: 0,
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          overflow: "auto",
          padding: "2.8rem",
          background: transparent ? "none" : "hsl(0 0% 0% / 40%)",
        },
        customUnderlayProps?.css
      )}
      {...underlayProps}
    >
      <FocusScope contain restoreFocus autoFocus>
        <div
          ref={ref}
          {...overlayProps}
          {...dialogProps}
          {...modalProps}
          {...dialogElementProps}
        >
          {typeof children === "function" ? children({ titleProps }) : children}
        </div>
      </FocusScope>
    </div>
  );
};

const DialogWrapper = ({
  isOpen,
  onRequestClose,
  children,
  transparent,
  underlayProps,
  ...props
}) => {
  if (!isOpen) return null;
  return (
    <OverlayContainer>
      <Dialog
        isOpen
        onClose={onRequestClose}
        isDismissable
        transparent={transparent}
        underlayProps={underlayProps}
        dialogElementProps={props}
      >
        {children}
      </Dialog>
    </OverlayContainer>
  );
};

const StyledDialog = ({ width = "62rem", children, ...props }) => {
  const theme = useTheme();
  return (
    <DialogWrapper
      css={css({
        width: "100%",
        maxWidth: width,
        height: "min(calc(100% - 3rem), 82rem)",
        maxHeight: "min(calc(100% - 3rem), 82rem)",
        borderRadius: "0.4rem",
        color: theme.colors.textNormal,
        background: theme.colors.backgroundPrimary,
        boxShadow:
          "rgb(15 15 15 / 10%) 0px 0px 0px 1px, rgb(15 15 15 / 20%) 0px 5px 10px, rgb(15 15 15 / 40%) 0px 15px 40px",
      })}
      {...props}
    >
      {children}
    </DialogWrapper>
  );
};

export default StyledDialog;
