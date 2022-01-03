import express, { Request, Response } from 'express';
import cookieParser from 'cookie-parser';
import createError from 'http-errors';
import logger from 'morgan';
import path from 'path';

/**
 * Import the routes
 */
import indexRouter from './routes/index';
import randomRouter from './routes/random';

const app = express();

// Views folder and uses Pug as the view engine
app.set('views', path.join(__dirname, 'public/views'));
app.set('view engine', 'pug');
// To make the json data displayed pretty
app.set('json spaces', 2);

app.use(logger('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));

// Use the following endpoints for the paths
app.use('/', indexRouter);
app.use('/random', randomRouter);

app.use(function (req, res, next) {
    next(createError(404));
});

app.use(function (err: createError.HttpError, req: Request, res: Response) {
    res.locals.message = err.message;
    res.locals.error = req.app.get('env') === 'development' ? err : {};

    res.status(err.status || 500);
    res.render('error');
});

export { app };
