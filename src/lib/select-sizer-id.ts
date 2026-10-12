// The sizer's test id is the trigger's plus this suffix; `controlHeightViolations` skips it, since the
// sizer is a hidden layout aid, not a control. Its own module, so `@suite/ui/testing` pulls in no
// component code.
export const SIZER_TEST_ID_SUFFIX = "-sizer";
