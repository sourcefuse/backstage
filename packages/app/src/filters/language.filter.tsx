import { DefaultEntityFilters, EntityFilter, useEntityList } from '@backstage/plugin-catalog-react';
import { Entity } from '@backstage/catalog-model';
import React, { ReactNode } from 'react';
import { FormControl, Typography, FormGroup, FormControlLabel, Checkbox } from '@material-ui/core';

class EntityLanguageFilter implements EntityFilter {
  constructor(readonly values: string[]) {}
  getCatalogFilters(): Record<string, string | symbol | (string | symbol)[]> {
    return { 'spec.language': this.values }
  } ;
  // filterEntity(entity: Entity): boolean {
  //   return true;
  //   // const spec = entity.metadata.spec;
  //   // if (spec && spec.language?) {}
  //   // return spec !== undefined && this.values.includes(spec?.language);
  // }
}

export type CustomFilters = DefaultEntityFilters & {
  languages?: EntityLanguageFilter;
};

export const EntityLanguagePicker = () => {
  // The language key is recognized due to the CustomFilter generic
  const {
    filters: { languages },
    updateFilters,
  } = useEntityList<CustomFilters>();

  // Toggles the value, depending on whether it's already selected
  function onChange(value: string) {
    const newLanguages = languages?.values.includes(value)
      ? languages.values.filter(language => language !== value)
      : [...(languages?.values ?? []), value];
    updateFilters({
      languages: newLanguages.length
        ? new EntityLanguageFilter(newLanguages)
        : undefined,
    });
  }

  const languageOptions = ['Node JS', 'PHP'];
  return (
    <FormControl component="fieldset">
      <Typography variant="button">Languages</Typography>
      <FormGroup>
        {languageOptions.map(language => (
          <FormControlLabel
            key={language}
            control={
              <Checkbox
                checked={languages?.values.includes(language)}
                onChange={() => onChange(language)}
              />
            }
            label={`${language}`}
          />
        ))}
      </FormGroup>
    </FormControl>
  );
};
