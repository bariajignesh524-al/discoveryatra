import asyncio
from motor.motor_asyncio import AsyncIOMotorClient

async def main():
    try:
        client = AsyncIOMotorClient('mongodb://localhost:27017', serverSelectionTimeoutMS=2000)
        db = client['discoveryatra']
        # Try to ping server
        await client.admin.command('ping')
        docs = await db.destinations.find({}, {'_id':0}).to_list(100)
        print("DATABASE CITIES:", [d['name'] for d in docs])
    except Exception as e:
        print("ERROR:", e)

if __name__ == '__main__':
    asyncio.run(main())
