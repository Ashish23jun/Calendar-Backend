const Event = require("../models/Event");
const { googlecalendar } = require("./auth");
const getEvents = async (req, res) => {
  try {
    // Fetch only the events belonging to the logged-in user
    const events = await Event.find({ user: req.id }).populate("user", "name");

    return res.json({
      ok: true,
      events,
    });
  } catch (error) {
    console.log(error);
    return res.status(500).json({
      ok: false,
      msg: "Please, contact the administrator",
    });
  }
};

const createEvent = async (req, res) => {
  const { title, start, end, notes } = req.body;

  const event = new Event({
    title,
    start,
    end,
    notes,
    user: req.id,
  });

  try {
    // Create event in Google Calendar
    const googleEvent = {
      summary: title,
      start: {
        dateTime: start,
        timeZone: "UTC",
      },
      end: {
        dateTime: end,
        timeZone: "UTC",
      },
      description: notes,
    };

    const calendarEvent = await googlecalendar.events.insert({
      calendarId: "primary",
      resource: googleEvent,
    });

    // Save Google Calendar event ID
    event.googleCalendarId = calendarEvent.data.id;
    await event.save();
    return res.status(201).json({
      ok: true,
      event,
    });
  } catch (error) {
    console.log(error);
    return res.status(500).json({
      ok: false,
      msg: "Please, contact the administrator",
    });
  }
};

const updateEvent = async (req, res) => {
  const { id } = req.params;
  const { title, start, end, notes } = req.body;

  try {
    // Find the event in your database
    const event = await Event.findById(id);
    if (!event) {
      return res.status(404).json({
        ok: false,
        msg: "Event not found",
      });
    }

    // Create the updated event object for Google Calendar
    const googleEvent = {
      summary: title,
      start: {
        dateTime: start,
        timeZone: "UTC", // Adjust if needed
      },
      end: {
        dateTime: end,
        timeZone: "UTC", // Adjust if needed
      },
      description: notes,
    };

    // Try to update the event in Google Calendar using the googleCalendarId
    const calendarEvent = await googlecalendar.events.update({
      calendarId: "primary",
      eventId: event.googleCalendarId, // Use the stored Google Calendar event ID
      resource: googleEvent,
    });

    if (calendarEvent.status !== 200) {
      return res.status(500).json({
        ok: false,
        msg: "Failed to update event in Google Calendar",
      });
    }

    // Update the event in the database after successful Google Calendar update
    event.title = title;
    event.start = start;
    event.end = end;
    event.notes = notes;

    await event.save();

    // Return the updated event data
    return res.json({
      ok: true,
      event, // Updated event from the database
    });
  } catch (error) {
    console.log(error);
    return res.status(500).json({
      ok: false,
      msg: "Please, contact the administrator",
    });
  }
};

const deleteEvent = async (req, res) => {
  const { id } = req.params;

  try {
    // Find the event in the database
    const event = await Event.findById(id);
    if (!event) {
      return res.status(404).json({
        ok: false,
        msg: "Event not found",
      });
    }

    // Check if the googleCalendarId exists
    if (!event.googleCalendarId) {
      return res.status(400).json({
        ok: false,
        msg: "Google Calendar event ID not found",
      });
    }

    // Log googleCalendarId for debugging
    console.log(
      "Deleting event with Google Calendar ID:",
      event.googleCalendarId
    );

    // Delete the event from Google Calendar using the googleCalendarId
    const calendarDeleteResponse = await googlecalendar.events.delete({
      calendarId: "primary",
      eventId: event.googleCalendarId, // Use the stored Google Calendar event ID
    });

    if (calendarDeleteResponse.status !== 204) {
      return res.status(500).json({
        ok: false,
        msg: "Failed to delete event from Google Calendar",
      });
    }

    // Delete the event from the database after successful deletion from Google Calendar
    await Event.findByIdAndDelete(id);

    return res.json({
      ok: true,
      msg: "Event deleted successfully",
    });
  } catch (error) {
    console.log(error);
    return res.status(500).json({
      ok: false,
      msg: "Please, contact the administrator",
    });
  }
};

module.exports = { getEvents, createEvent, updateEvent, deleteEvent };
