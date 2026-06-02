<?php

namespace App\Console\Commands;

use App\Models\Record;
use Illuminate\Console\Command;
use App\Http\Controllers\AiController;

class TrainModelCommand extends Command
{
    protected $signature = 'ai:train-model';
    protected $description = 'Train the AI model with the current records';

    public function __construct()
    {
        parent::__construct();
    }

    public function handle()
    {
        $controller = new AiController();
        $controller->trainModel();

        $this->info('AI model trained successfully.');
    }
}
