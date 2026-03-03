import React, { useEffect, useState, useCallback } from 'react';
import {
  EntityFilter,
  useEntityList,
} from '@backstage/plugin-catalog-react';
import {
  FormControl,
  Typography,
  FormGroup,
  FormControlLabel,
  Checkbox,
} from '@material-ui/core';
import { makeStyles } from '@material-ui/core/styles';
import { Entity, stringifyEntityRef } from '@backstage/catalog-model';
import { discoveryApiRef, fetchApiRef, useApi } from '@backstage/core-plugin-api';

interface TagDefinition {
  id: number;
  tag_name: string;
  color: string;
}

export class EntityCustomTagFilter implements EntityFilter {
  constructor(
    readonly tagIds: number[],
    readonly matchingEntityRefs: Set<string>,
  ) {}

  filterEntity(entity: Entity): boolean {
    if (this.tagIds.length === 0) return true;
    const ref = stringifyEntityRef(entity);
    return this.matchingEntityRefs.has(ref);
  }
}

const useStyles = makeStyles({
  colorDot: {
    width: 10,
    height: 10,
    borderRadius: '50%',
    display: 'inline-block',
    marginRight: 6,
  },
});

export const EntityCustomTagPicker = () => {
  const classes = useStyles();
  const discoveryApi = useApi(discoveryApiRef);
  const fetchApi = useApi(fetchApiRef);
  const { updateFilters } = useEntityList();

  const [tags, setTags] = useState<TagDefinition[]>([]);
  const [selectedIds, setSelectedIds] = useState<number[]>([]);

  const loadTags = useCallback(async () => {
    try {
      const baseUrl = await discoveryApi.getBaseUrl('entity-tags');
      const res = await fetchApi.fetch(`${baseUrl}/tags`);
      if (res.ok) setTags(await res.json());
    } catch {
      // ignore
    }
  }, [discoveryApi, fetchApi]);

  useEffect(() => {
    loadTags();
  }, [loadTags]);

  const applyFilter = useCallback(
    async (newSelectedIds: number[]) => {
      if (newSelectedIds.length === 0) {
        updateFilters({ customTags: undefined } as any);
        return;
      }
      try {
        const baseUrl = await discoveryApi.getBaseUrl('entity-tags');
        const res = await fetchApi.fetch(
          `${baseUrl}/entities?tagIds=${newSelectedIds.join(',')}`,
        );
        const entityRefs: string[] = res.ok ? await res.json() : [];
        updateFilters({
          customTags: new EntityCustomTagFilter(
            newSelectedIds,
            new Set(entityRefs),
          ),
        } as any);
      } catch {
        updateFilters({ customTags: undefined } as any);
      }
    },
    [discoveryApi, fetchApi, updateFilters],
  );

  const onChange = (tagId: number) => {
    const newSelected = selectedIds.includes(tagId)
      ? selectedIds.filter(id => id !== tagId)
      : [...selectedIds, tagId];
    setSelectedIds(newSelected);
    applyFilter(newSelected);
  };

  if (tags.length === 0) return null;

  return (
    <FormControl component="fieldset">
      <Typography variant="button">My Tags</Typography>
      <FormGroup>
        {tags.map(tag => (
          <FormControlLabel
            key={tag.id}
            control={
              <Checkbox
                checked={selectedIds.includes(tag.id)}
                onChange={() => onChange(tag.id)}
                size="small"
              />
            }
            label={
              <span>
                <span
                  className={classes.colorDot}
                  style={{ backgroundColor: tag.color }}
                />
                {tag.tag_name}
              </span>
            }
          />
        ))}
      </FormGroup>
    </FormControl>
  );
};
