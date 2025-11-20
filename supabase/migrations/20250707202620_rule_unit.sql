create type public.rule_unit as enum ('DAY', 'MONTH', 'YEAR');

ALTER TYPE public.rule_unit OWNER TO postgres;
