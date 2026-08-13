import express from 'express';
import multer from 'multer';
import { generatePost, getGenerations, getPosts, schedulePost } from '../controllers/postController.js';
import { protect } from '../middlewares/authMiddlewware.js';

const router = express.Router();

const storage = multer.memoryStorage();
const upload = multer({ storage: storage });

router.route('/generate').post(protect, upload.single('referenceImage'), generatePost);

router.route('/generations').get(protect, getGenerations);

router.route('/')
  .get(protect, getPosts)
  .post(protect, upload.single('media'), schedulePost);

export default router;
