# Appointment vehicle assignment

Each appointment can be assigned to one shop vehicle. The value is stored in the
`Vehicle` field in column R of the Appointments sheet.

The supported values are `VAN` for the closed-box pickup truck and `MOTORCYCLE` for
the motorcycle. A null value means that no vehicle has been assigned yet, including
appointments created before this field was added.

The form offers the two vehicles only and defaults to VAN, both when creating an
appointment and when rescheduling one that has no vehicle yet. The appointment card
shows the assigned vehicle as its leading icon (truck or motorcycle); an unassigned
card keeps its status icon.
