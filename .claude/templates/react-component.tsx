/**
 * @module ComponentName
 * @category Component
 * @description Brief description of what this component does
 */
import React from 'react';
import { Box, Typography, Card, CardMedia } from '@mui/material';
import { motion } from 'framer-motion';

export interface ComponentNameProps {
  /** Wallpaper data to display */
  wallpaper: Wallpaper;
  /** Click handler for preview */
  onPreview?: (id: string) => void;
  /** Loading state flag */
  isLoading?: boolean;
}

/**
 * Description of the component
 */
export const ComponentName: React.FC<ComponentNameProps> = ({
  wallpaper,
  onPreview,
  isLoading = false,
}) => {
  if (isLoading) {
    return <Typography>Loading...</Typography>;
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0 }}
    >
      <Card
        sx={{ cursor: 'pointer', transition: 'transform 0.3s' }}
        onClick={() => onPreview?.(wallpaper.id)}
      >
        <CardMedia
          component="img"
          image={wallpaper.thumbnailUrl}
          alt={wallpaper.title}
          loading="lazy"
        />
        <Typography variant="subtitle1">{wallpaper.title}</Typography>
      </Card>
    </motion.div>
  );
};
