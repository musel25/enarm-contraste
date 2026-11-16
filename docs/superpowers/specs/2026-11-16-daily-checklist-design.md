# Daily Checklist design

The student can plan activities for a date, mark them complete, and inspect a prior date. A new top navigation tab opens the checklist. Today is the initial date. A date control and a shortcut to yesterday support history and future planning.

## Approaches

- Store tasks only in the browser: simple, but the history would not follow the student's account.
- Create a separate server table: independent writes, but backup export and profile recovery would omit the list.
- Add an optional checklist field to the existing version 3 study profile: the existing server confirms each write, revision checks protect other devices, and backup export includes tasks. Use this approach.

## Behavior and limits

Each date has an ordered list of activities. A student can add, complete, reopen, and remove an activity. The interface shows the completed count. It keeps past dates until the student removes individual activities. It does not create recurring tasks or change study goals.

The existing progress code identifies the owner. A write changes the visible list only after server confirmation. A failed write keeps the entered text and shows an error. A revision conflict asks the student to reload before another change. The field is optional so older profiles stay valid. Validate dates, IDs, text, booleans, and record shape at the profile boundary.
