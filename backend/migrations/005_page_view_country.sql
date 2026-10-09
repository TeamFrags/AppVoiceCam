-- Country of the visitor, as a two-letter code. It is worked out from the IP address by the
-- proxy in front of the API, for the time of the request: the address itself is still never
-- stored, and a country alone does not single anyone out.
alter table page_views add column country text;
