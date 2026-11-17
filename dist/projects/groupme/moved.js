// Discard credentials from historical OAuth links before shared scripts run.
if(location.search||location.hash)history.replaceState(null,'',location.pathname);
