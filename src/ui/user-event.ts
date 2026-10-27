// Whether an event comes from the user, not from code: a component that sets its value from a prop
// (a Radix bubble select or slider, the combobox's hidden input) dispatches untrusted events. Its own
// module so unit tests, whose events are all untrusted, can stand in for the browser.
function isUserEvent(event: Event): boolean {
  return event.isTrusted;
}

export { isUserEvent };
