// **------calendar js**

document.addEventListener('DOMContentLoaded', function () {
    const calendarEl = document.getElementById('calendar');
    if (!calendarEl) return;

    const DEFAULT_CLASS = 'event-primary';

    const calendar = new FullCalendar.Calendar(calendarEl, {
        initialView: 'dayGridMonth',
        navLinks: true,
        editable: true,
        dayMaxEvents: true,
        selectable: true,
        selectMirror: true,
        droppable: true,
        headerToolbar: {
            left: 'prev,next today',
            center: 'title',
            right: 'dayGridMonth,timeGridWeek,timeGridDay,listWeek,addEventButton'
        },
        customButtons: {
            addEventButton: {
                text: 'Add event',
                click: async function () {
                    const rawTitle = prompt('Event Title:');
                    if (!rawTitle) return;
                    const title = rawTitle.trim();
                    if (!title) {
                        alert('Event title cannot be empty.');
                        return;
                    }

                    const startInput = prompt('Start (YYYY-MM-DD or YYYY-MM-DDTHH:MM):');
                    if (!startInput) return;
                    const startDate = new Date(startInput);
                    if (!Number.isFinite(startDate.getTime())) {
                        alert('Invalid start date.');
                        return;
                    }

                    const endInput = prompt('End (optional, same format):');
                    let endDate = null;
                    if (endInput) {
                        const parsedEnd = new Date(endInput);
                        if (!Number.isFinite(parsedEnd.getTime())) {
                            alert('Invalid end date.');
                            return;
                        }
                        endDate = parsedEnd;
                    }

                    const descriptionInput = prompt('Description (optional):') || '';

                    try {
                        const created = await createEvent({
                            title,
                            start: startDate.toISOString(),
                            end: endDate ? endDate.toISOString() : null,
                            allDay: !startInput.includes('T') && !endDate,
                            className: DEFAULT_CLASS,
                            description: descriptionInput.trim() ? descriptionInput.trim() : null
                        });
                        calendar.addEvent(mapApiEvent(created));
                    } catch (error) {
                        console.error('Failed to create event via quick add', error);
                        alert('Unable to save event. Please try again.');
                    }
                }
            }
        },
        events: fetchCalendarEvents,
        eventClick: handleEventClick,
        select: handleDateSelect,
        eventDrop: handleEventDrop,
        eventResize: handleEventResize,
        eventReceive: handleEventReceive,
        drop: handleExternalDrop
    });

    const containerEl = document.getElementById('events-list');
    if (containerEl && FullCalendar.Draggable) {
        new FullCalendar.Draggable(containerEl, {
            itemSelector: '.list-event',
            eventData: function (eventEl) {
                return {
                    title: eventEl.innerText.trim(),
                    className: eventEl.getAttribute('data-class') || DEFAULT_CLASS
                };
            }
        });
    }

    calendar.render();

    async function fetchCalendarEvents(_info, successCallback, failureCallback) {
        try {
            const response = await fetch('/api/calendar', { credentials: 'include' });
            if (!response.ok) {
                throw new Error(await getErrorMessage(response));
            }
            const data = await response.json();
            successCallback(data.map(mapApiEvent));
        } catch (error) {
            console.error('Failed to load calendar events', error);
            if (failureCallback) failureCallback(error);
        }
    }

    async function createEvent(payload) {
        const body = {
            title: payload.title,
            start: payload.start,
            end: payload.end || null,
            allDay: Boolean(payload.allDay),
            className: payload.className || DEFAULT_CLASS,
            description: payload.description || null
        };

        const response = await fetch('/api/calendar', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify(body)
        });

        if (!response.ok) {
            throw new Error(await getErrorMessage(response));
        }

        return response.json();
    }

    async function updateEventRequest(event) {
        const payload = eventPayloadFromCalendar(event);

        const response = await fetch(`/api/calendar/${event.id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify(payload)
        });

        if (!response.ok) {
            throw new Error(await getErrorMessage(response));
        }

        return response.json();
    }

    async function deleteEventRequest(event) {
        const response = await fetch(`/api/calendar/${event.id}`, {
            method: 'DELETE',
            credentials: 'include'
        });

        if (!response.ok) {
            throw new Error(await getErrorMessage(response));
        }
    }

    async function handleDateSelect(selectionInfo) {
        try {
            const rawTitle = prompt('Event Title:');
            if (!rawTitle) return;
            const title = rawTitle.trim();
            if (!title) {
                alert('Event title cannot be empty.');
                return;
            }

            const descriptionInput = prompt('Description (optional):') || '';

            const created = await createEvent({
                title,
                start: selectionInfo.start ? selectionInfo.start.toISOString() : null,
                end: selectionInfo.end ? selectionInfo.end.toISOString() : null,
                allDay: selectionInfo.allDay,
                className: DEFAULT_CLASS,
                description: descriptionInput.trim() ? descriptionInput.trim() : null
            });

            calendar.addEvent(mapApiEvent(created));
        } catch (error) {
            console.error('Failed to create event from selection', error);
            alert('Unable to save event. Please try again.');
        } finally {
            calendar.unselect();
        }
    }

    async function handleEventDrop(info) {
        try {
            const updated = await updateEventRequest(info.event);
            applyServerEvent(info.event, updated);
        } catch (error) {
            console.error('Failed to update event (drag/drop)', error);
            info.revert();
            alert('Unable to update event. Changes reverted.');
        }
    }

    async function handleEventResize(info) {
        try {
            const updated = await updateEventRequest(info.event);
            applyServerEvent(info.event, updated);
        } catch (error) {
            console.error('Failed to update event (resize)', error);
            info.revert();
            alert('Unable to update event duration. Changes reverted.');
        }
    }

    async function handleEventReceive(info) {
        try {
            const created = await createEvent(eventPayloadFromCalendar(info.event));
            info.event.setProp('id', created.id);
            applyServerEvent(info.event, created);
        } catch (error) {
            console.error('Failed to save received event', error);
            if (info.revert) {
                info.revert();
            } else {
                info.event.remove();
            }
            alert('Unable to save dragged event.');
        }
    }

    function handleExternalDrop(arg) {
        const dropRemove = document.getElementById('drop-remove');
        if (dropRemove && dropRemove.checked) {
            arg.draggedEl.parentNode.removeChild(arg.draggedEl);
        }
    }

    async function handleEventClick(info) {
        const event = info.event;
        const startText = event.start ? event.start.toLocaleString() : '--';
        const endText = event.end ? event.end.toLocaleString() : '--';
        const description = event.extendedProps && event.extendedProps.description
            ? `\nDescription: ${event.extendedProps.description}`
            : '';

        const shouldDelete = confirm(
            `Title: ${event.title}\nStart: ${startText}\nEnd: ${endText}${description}\n\nSelect OK to delete this event.`
        );

        if (!shouldDelete) return;

        try {
            await deleteEventRequest(event);
            event.remove();
        } catch (error) {
            console.error('Failed to delete event', error);
            alert('Unable to delete event. Please try again.');
        }
    }

    function eventPayloadFromCalendar(event) {
        return {
            title: event.title,
            start: event.start ? event.start.toISOString() : null,
            end: event.end ? event.end.toISOString() : null,
            allDay: event.allDay,
            className: getPrimaryClassName(event) || DEFAULT_CLASS,
            description: event.extendedProps && event.extendedProps.description
                ? event.extendedProps.description
                : null
        };
    }

    function mapApiEvent(data) {
        const className = data.className || (Array.isArray(data.classNames) && data.classNames[0]) || null;
        const mapped = {
            id: data.id,
            title: data.title,
            start: data.start,
            allDay: Boolean(data.allDay),
            extendedProps: {
                description: data.extendedProps && data.extendedProps.description
                    ? data.extendedProps.description
                    : ''
            }
        };

        if (data.end) mapped.end = data.end;
        if (className) mapped.className = [className];

        return mapped;
    }

    function applyServerEvent(event, data) {
        if (!data) return;

        event.setProp('title', data.title);
        event.setDates(data.start, data.end || null, { allDay: Boolean(data.allDay) });

        const className = data.className || (Array.isArray(data.classNames) && data.classNames[0]) || null;
        event.setProp('classNames', className ? [className] : []);

        const description = data.extendedProps && data.extendedProps.description
            ? data.extendedProps.description
            : '';
        event.setExtendedProp('description', description);
    }

    function getPrimaryClassName(event) {
        if (Array.isArray(event.classNames) && event.classNames.length) {
            return event.classNames[0];
        }
        return event.className || null;
    }

    async function getErrorMessage(response) {
        try {
            const payload = await response.json();
            if (payload && payload.error) return payload.error;
            if (payload && payload.message) return payload.message;
        } catch (_err) {
            // ignore JSON parse errors
        }
        return response.statusText || 'Request failed';
    }
});

// **------slider js**

$('.slider').slick({
    dots: false,
    speed: 1000,
    slidesToShow: 3,
    centerMode: true,
    arrows: false,
    vertical: true,
    verticalSwiping: true,
    focusOnSelect: true,
    autoplay: true,
    autoplaySpeed: 1000,
});
