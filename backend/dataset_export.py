"""
Dataset Export Utilities
Supports YOLO, COCO, and Pascal VOC formats
"""

import os
import json
import shutil
from pathlib import Path
from typing import List, Dict, Any, Tuple
from datetime import datetime
import xml.etree.ElementTree as ET
from xml.dom import minidom
import yaml


class DatasetExporter:
    """Export datasets to various formats"""
    
    def __init__(self, export_dir: Path):
        self.export_dir = export_dir
        self.export_dir.mkdir(parents=True, exist_ok=True)
    
    def export_yolo(self, project_name: str, images: List[Dict], 
                    annotations: List[Dict], classes: List[Dict],
                    splits: Dict[str, List[int]] = None) -> Tuple[str, Dict]:
        """
        Export to YOLO format
        
        Structure:
        project_name/
            data.yaml
            train/
                images/
                labels/
            valid/
                images/
                labels/
            test/
                images/
                labels/
        """
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        export_path = self.export_dir / f"{project_name}_yolo_{timestamp}"
        export_path.mkdir(parents=True, exist_ok=True)
        
        # Create class mapping
        class_names = [c['name'] for c in sorted(classes, key=lambda x: x['id'])]
        class_id_map = {c['id']: idx for idx, c in enumerate(sorted(classes, key=lambda x: x['id']))}
        
        # Group images by split
        if splits is None:
            splits = {'train': [], 'valid': [], 'test': []}
            for img in images:
                split = img.get('split', 'train')
                if split not in splits:
                    splits[split] = []
                splits[split].append(img['id'])
        
        # Create annotations lookup
        ann_by_image = {}
        for ann in annotations:
            img_id = ann['image_id']
            if img_id not in ann_by_image:
                ann_by_image[img_id] = []
            ann_by_image[img_id].append(ann)
        
        stats = {'total_images': 0, 'total_annotations': 0}
        
        for split_name, image_ids in splits.items():
            if not image_ids:
                continue
            
            split_images_dir = export_path / split_name / "images"
            split_labels_dir = export_path / split_name / "labels"
            split_images_dir.mkdir(parents=True, exist_ok=True)
            split_labels_dir.mkdir(parents=True, exist_ok=True)
            
            for img in images:
                if img['id'] not in image_ids:
                    continue
                
                # Copy image
                src_path = img['filepath']
                dst_path = split_images_dir / img['filename']
                shutil.copy2(src_path, dst_path)
                stats['total_images'] += 1
                
                # Create label file
                label_filename = Path(img['filename']).stem + ".txt"
                label_path = split_labels_dir / label_filename
                
                img_anns = ann_by_image.get(img['id'], [])
                img_w, img_h = img['width'], img['height']
                
                with open(label_path, 'w') as f:
                    for ann in img_anns:
                        if ann['annotation_type'] == 'bbox':
                            data = ann['data']
                            # Convert to YOLO format (normalized center x, y, width, height)
                            x_center = (data['x'] + data['width'] / 2) / img_w
                            y_center = (data['y'] + data['height'] / 2) / img_h
                            w_norm = data['width'] / img_w
                            h_norm = data['height'] / img_h
                            
                            class_idx = class_id_map.get(ann['class_id'], 0)
                            f.write(f"{class_idx} {x_center:.6f} {y_center:.6f} {w_norm:.6f} {h_norm:.6f}\n")
                            stats['total_annotations'] += 1
        
        # Create data.yaml
        data_yaml = {
            'path': str(export_path.absolute()),
            'train': 'train/images',
            'val': 'valid/images',
            'test': 'test/images' if 'test' in splits and splits['test'] else '',
            'names': {i: name for i, name in enumerate(class_names)},
            'nc': len(class_names)
        }
        
        with open(export_path / 'data.yaml', 'w') as f:
            yaml.dump(data_yaml, f, default_flow_style=False)
        
        return str(export_path), stats
    
    def export_coco(self, project_name: str, images: List[Dict],
                    annotations: List[Dict], classes: List[Dict]) -> Tuple[str, Dict]:
        """
        Export to COCO format
        
        Structure:
        project_name/
            images/
            annotations/
                instances_train.json
                instances_valid.json
        """
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        export_path = self.export_dir / f"{project_name}_coco_{timestamp}"
        images_path = export_path / "images"
        ann_path = export_path / "annotations"
        images_path.mkdir(parents=True, exist_ok=True)
        ann_path.mkdir(parents=True, exist_ok=True)
        
        # Create categories
        categories = [
            {"id": c['id'], "name": c['name'], "supercategory": "object"}
            for c in classes
        ]
        
        # Group by split
        splits_data = {}
        for img in images:
            split = img.get('split', 'train')
            if split not in splits_data:
                splits_data[split] = {'images': [], 'annotations': []}
            splits_data[split]['images'].append(img)
        
        # Add annotations to splits
        img_to_split = {img['id']: img.get('split', 'train') for img in images}
        for ann in annotations:
            split = img_to_split.get(ann['image_id'], 'train')
            if split in splits_data:
                splits_data[split]['annotations'].append(ann)
        
        stats = {'total_images': 0, 'total_annotations': 0}
        ann_id_counter = 1
        
        for split_name, split_content in splits_data.items():
            coco_images = []
            coco_annotations = []
            
            for img in split_content['images']:
                # Copy image
                src_path = img['filepath']
                dst_path = images_path / img['filename']
                shutil.copy2(src_path, dst_path)
                stats['total_images'] += 1
                
                coco_images.append({
                    "id": img['id'],
                    "file_name": img['filename'],
                    "width": img['width'],
                    "height": img['height']
                })
            
            for ann in split_content['annotations']:
                if ann['annotation_type'] == 'bbox':
                    data = ann['data']
                    coco_annotations.append({
                        "id": ann_id_counter,
                        "image_id": ann['image_id'],
                        "category_id": ann['class_id'],
                        "bbox": [data['x'], data['y'], data['width'], data['height']],
                        "area": data['width'] * data['height'],
                        "iscrowd": 0
                    })
                    ann_id_counter += 1
                    stats['total_annotations'] += 1
            
            # Save COCO JSON
            coco_data = {
                "info": {
                    "description": f"{project_name} - {split_name}",
                    "date_created": datetime.now().isoformat()
                },
                "images": coco_images,
                "annotations": coco_annotations,
                "categories": categories
            }
            
            with open(ann_path / f"instances_{split_name}.json", 'w') as f:
                json.dump(coco_data, f, indent=2)
        
        return str(export_path), stats
    
    def export_voc(self, project_name: str, images: List[Dict],
                   annotations: List[Dict], classes: List[Dict]) -> Tuple[str, Dict]:
        """
        Export to Pascal VOC format
        
        Structure:
        project_name/
            Annotations/
            ImageSets/
                Main/
                    train.txt
                    valid.txt
            JPEGImages/
        """
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        export_path = self.export_dir / f"{project_name}_voc_{timestamp}"
        
        ann_dir = export_path / "Annotations"
        img_dir = export_path / "JPEGImages"
        sets_dir = export_path / "ImageSets" / "Main"
        
        for d in [ann_dir, img_dir, sets_dir]:
            d.mkdir(parents=True, exist_ok=True)
        
        # Create class name lookup
        class_names = {c['id']: c['name'] for c in classes}
        
        # Group annotations by image
        ann_by_image = {}
        for ann in annotations:
            img_id = ann['image_id']
            if img_id not in ann_by_image:
                ann_by_image[img_id] = []
            ann_by_image[img_id].append(ann)
        
        # Group images by split
        splits = {}
        stats = {'total_images': 0, 'total_annotations': 0}
        
        for img in images:
            split = img.get('split', 'train')
            if split not in splits:
                splits[split] = []
            
            img_name = Path(img['filename']).stem
            splits[split].append(img_name)
            
            # Copy image
            src_path = img['filepath']
            dst_path = img_dir / img['filename']
            shutil.copy2(src_path, dst_path)
            stats['total_images'] += 1
            
            # Create XML annotation
            root = ET.Element("annotation")
            ET.SubElement(root, "folder").text = "JPEGImages"
            ET.SubElement(root, "filename").text = img['filename']
            
            size = ET.SubElement(root, "size")
            ET.SubElement(size, "width").text = str(img['width'])
            ET.SubElement(size, "height").text = str(img['height'])
            ET.SubElement(size, "depth").text = "3"
            
            ET.SubElement(root, "segmented").text = "0"
            
            for ann in ann_by_image.get(img['id'], []):
                if ann['annotation_type'] == 'bbox':
                    data = ann['data']
                    obj = ET.SubElement(root, "object")
                    ET.SubElement(obj, "name").text = class_names.get(ann['class_id'], 'unknown')
                    ET.SubElement(obj, "pose").text = "Unspecified"
                    ET.SubElement(obj, "truncated").text = "0"
                    ET.SubElement(obj, "difficult").text = "0"
                    
                    bndbox = ET.SubElement(obj, "bndbox")
                    ET.SubElement(bndbox, "xmin").text = str(int(data['x']))
                    ET.SubElement(bndbox, "ymin").text = str(int(data['y']))
                    ET.SubElement(bndbox, "xmax").text = str(int(data['x'] + data['width']))
                    ET.SubElement(bndbox, "ymax").text = str(int(data['y'] + data['height']))
                    stats['total_annotations'] += 1
            
            # Pretty print XML
            xml_str = minidom.parseString(ET.tostring(root)).toprettyxml(indent="  ")
            with open(ann_dir / f"{img_name}.xml", 'w') as f:
                f.write(xml_str)
        
        # Create split files
        for split_name, img_names in splits.items():
            with open(sets_dir / f"{split_name}.txt", 'w') as f:
                f.write("\n".join(img_names))
        
        return str(export_path), stats
