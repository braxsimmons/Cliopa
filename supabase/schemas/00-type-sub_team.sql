-- Sub-team enum for organizing agents into sub-groups within teams
CREATE TYPE public.sub_team AS ENUM (
    'Cascade',
    'Denali',
    'DSS/NSS',
    'Everest',
    'Fuji',
    'Kilimanjaro',
    'K2',
    'Matterhorn'
);
